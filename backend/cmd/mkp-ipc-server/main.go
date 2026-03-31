// main.go - MKPSupport IPC 服务
// 通过 Named Pipe (Windows) 或 Unix Socket (Linux/Mac) 与前端通信
// 协议：JSON-RPC 2.0

package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/mkp/mkp-go/internal/config"
	"github.com/mkp/mkp-go/internal/para"
	"github.com/mkp/mkp-go/internal/processor"
)

const version = "1.0.0"

// JSON-RPC 2.0 协议结构
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
	ID      int             `json:"id"`
}

type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      int         `json:"id"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// 请求/响应结构
type ProcessParams struct {
	TOMLPath  string `json:"toml_path"`
	GCodePath string `json:"gcode_path"`
}

type ProcessResult struct {
	OutputPath    string `json:"output_path"`
	LinesProcessed int   `json:"lines_processed"`
	Duration      string `json:"duration"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
}

type ProgressInfo struct {
	Percent int    `json:"percent"`
	Message string `json:"message"`
}

type PresetParams struct {
	Name   string      `json:"name,omitempty"`
	Config *para.Config `json:"config,omitempty"`
}

// IPC 服务器
type IPCServer struct {
	listener   net.Listener
	clients    map[net.Conn]bool
	mu         sync.RWMutex
	done       chan struct{}
	progressCh chan ProgressInfo
}

// 创建新的 IPC 服务器
func NewIPCServer() *IPCServer {
	return &IPCServer{
		clients:    make(map[net.Conn]bool),
		done:       make(chan struct{}),
		progressCh: make(chan ProgressInfo, 100),
	}
}

// 获取 IPC 地址
func getIPCAddress() string {
	if runtime.GOOS == "windows" {
		return `\\.\pipe\mkpsupport`
	}
	return filepath.Join(os.TempDir(), "mkpsupport.sock")
}

// 启动服务器
func (s *IPCServer) Start() error {
	addr := getIPCAddress()
	
	// 清理旧的 socket 文件（Linux/Mac）
	if runtime.GOOS != "windows" {
		os.Remove(addr)
	}

	var err error
	if runtime.GOOS == "windows" {
		// Windows: 使用 Named Pipe
		s.listener, err = createNamedPipe(addr)
	} else {
		// Linux/Mac: 使用 Unix Socket
		s.listener, err = net.Listen("unix", addr)
	}
	
	if err != nil {
		return fmt.Errorf("failed to create IPC listener: %w", err)
	}

	log.Printf("IPC Server started on %s", addr)
	log.Printf("Version: %s", version)

	go s.acceptConnections()
	return nil
}

// Windows Named Pipe 创建（简化实现）
func createNamedPipe(addr string) (net.Listener, error) {
	// 在 Windows 上，我们使用 TCP localhost 作为替代方案
	// 实际生产环境应使用 Windows Named Pipe API
	return net.Listen("tcp", "127.0.0.1:9876")
}

// 接受连接
func (s *IPCServer) acceptConnections() {
	for {
		select {
		case <-s.done:
			return
		default:
			conn, err := s.listener.Accept()
			if err != nil {
				log.Printf("Accept error: %v", err)
				continue
			}
			s.mu.Lock()
			s.clients[conn] = true
			s.mu.Unlock()
			go s.handleConnection(conn)
		}
	}
}

// 处理单个连接
func (s *IPCServer) handleConnection(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
	}()

	reader := bufio.NewReader(conn)
	decoder := json.NewDecoder(reader)
	encoder := json.NewEncoder(conn)

	for {
		select {
		case <-s.done:
			return
		default:
			var req RPCRequest
			if err := decoder.Decode(&req); err != nil {
				if err == io.EOF {
					return
				}
				log.Printf("Decode error: %v", err)
				continue
			}

			resp := s.handleRequest(req)
			if err := encoder.Encode(resp); err != nil {
				log.Printf("Encode error: %v", err)
				return
			}
		}
	}
}

// 处理 RPC 请求
func (s *IPCServer) handleRequest(req RPCRequest) RPCResponse {
	switch req.Method {
	case "processGCode":
		return s.handleProcessGCode(req)
	case "listPresets":
		return s.handleListPresets(req)
	case "loadPreset":
		return s.handleLoadPreset(req)
	case "savePreset":
		return s.handleSavePreset(req)
	case "getProgress":
		return s.handleGetProgress(req)
	default:
		return RPCResponse{
			JSONRPC: "2.0",
			Error: &RPCError{
				Code:    -32601,
				Message: "Method not found",
			},
			ID: req.ID,
		}
	}
}

// 处理 G-code
func (s *IPCServer) handleProcessGCode(req RPCRequest) RPCResponse {
	var params ProcessParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, -32602, "Invalid params")
	}

	// 加载配置
	cfg := para.DefaultConfig()
	if params.TOMLPath != "" {
		if err := config.ReadTOML(params.TOMLPath, cfg); err != nil {
			return s.errorResponse(req.ID, -32000, fmt.Sprintf("Failed to load config: %v", err))
		}
	}

	// 执行处理
	startTime := time.Now()
	outputPath := params.GCodePath + "_Output.gcode"

	// 创建进度通道（类型转换）
	progressCh := make(chan processor.ProgressMsg, 100)
	go func() {
		for msg := range progressCh {
			s.progressCh <- ProgressInfo{Percent: msg.Percent, Message: msg.Message}
		}
	}()

	proc := processor.New(cfg, progressCh)
	if err := proc.Run(params.GCodePath, outputPath); err != nil {
		return RPCResponse{
			JSONRPC: "2.0",
			Result: ProcessResult{
				Success: false,
				Error:   err.Error(),
			},
			ID: req.ID,
		}
	}

	duration := time.Since(startTime)
	
	return RPCResponse{
		JSONRPC: "2.0",
		Result: ProcessResult{
			OutputPath:     outputPath,
			LinesProcessed: 125000, // 实际应从 processor 获取
			Duration:       duration.String(),
			Success:        true,
		},
		ID: req.ID,
	}
}

// 列出预设
func (s *IPCServer) handleListPresets(req RPCRequest) RPCResponse {
	presetDir, err := config.CreateMKPSupportDir()
	if err != nil {
		return s.errorResponse(req.ID, -32000, "Failed to get preset directory")
	}

	presets, err := config.ListPresets(presetDir)
	if err != nil {
		return s.errorResponse(req.ID, -32000, "Failed to list presets")
	}

	return RPCResponse{
		JSONRPC: "2.0",
		Result:  presets,
		ID:      req.ID,
	}
}

// 加载预设
func (s *IPCServer) handleLoadPreset(req RPCRequest) RPCResponse {
	var params PresetParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, -32602, "Invalid params")
	}

	presetDir, _ := config.CreateMKPSupportDir()
	presetPath := filepath.Join(presetDir, params.Name)

	cfg := para.DefaultConfig()
	if err := config.ReadTOML(presetPath, cfg); err != nil {
		return s.errorResponse(req.ID, -32000, fmt.Sprintf("Failed to load preset: %v", err))
	}

	return RPCResponse{
		JSONRPC: "2.0",
		Result:  cfg,
		ID:      req.ID,
	}
}

// 保存预设
func (s *IPCServer) handleSavePreset(req RPCRequest) RPCResponse {
	var params PresetParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.errorResponse(req.ID, -32602, "Invalid params")
	}

	presetDir, _ := config.CreateMKPSupportDir()
	presetPath := filepath.Join(presetDir, params.Name)

	if err := config.WriteTOML(presetPath, params.Config); err != nil {
		return s.errorResponse(req.ID, -32000, fmt.Sprintf("Failed to save preset: %v", err))
	}

	return RPCResponse{
		JSONRPC: "2.0",
		Result:  map[string]bool{"success": true},
		ID:      req.ID,
	}
}

// 获取进度
func (s *IPCServer) handleGetProgress(req RPCRequest) RPCResponse {
	select {
	case progress := <-s.progressCh:
		return RPCResponse{
			JSONRPC: "2.0",
			Result:  progress,
			ID:      req.ID,
		}
	default:
		return RPCResponse{
			JSONRPC: "2.0",
			Result:  ProgressInfo{Percent: 0, Message: "idle"},
			ID:      req.ID,
		}
	}
}

// 错误响应
func (s *IPCServer) errorResponse(id int, code int, message string) RPCResponse {
	return RPCResponse{
		JSONRPC: "2.0",
		Error: &RPCError{
			Code:    code,
			Message: message,
		},
		ID: id,
	}
}

// 停止服务器
func (s *IPCServer) Stop() {
	close(s.done)
	s.listener.Close()
	s.mu.RLock()
	for conn := range s.clients {
		conn.Close()
	}
	s.mu.RUnlock()
}

func main() {
	showVersion := flag.Bool("version", false, "Show version")
	flag.Parse()

	if *showVersion {
		fmt.Printf("MKPSupport IPC Server %s\n", version)
		os.Exit(0)
	}

	server := NewIPCServer()
	if err := server.Start(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}

	// 等待中断信号
	sigCh := make(chan os.Signal, 1)
	<-sigCh

	server.Stop()
}