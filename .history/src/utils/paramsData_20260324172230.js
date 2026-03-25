// src/utils/paramsData.js

export const PARAM_GROUP_META = {
  meta: { title: '预设信息', desc: '识别当前预设的版本、机型和显示名。', icon: 'info' },
  toolhead: { title: '工具头参数', desc: '控制胶笔速度、三轴补偿和工具头动作。', icon: 'toolhead' },
  wiping: { title: '擦嘴策略', desc: '控制擦嘴塔、擦嘴组件以及支撑相关策略。', icon: 'wiping' },
  mount: { title: '工具头展开 G-code', desc: '默认展示完整文本，支持切换到逐行精修模式。', icon: 'mount' },
  unmount: { title: '工具头收起 G-code', desc: '默认展示完整文本，支持切换到逐行精修模式。', icon: 'unmount' },
  advanced: { title: '扩展参数', desc: '当前 JSON 中存在但未分类的高级字段。', icon: 'advanced' }
};

export const PARAM_FIELD_META = {
  version: { label: '预设版本', desc: '当前预设的真实版本号。', group: 'meta' },
  printer: { label: '适用机型', desc: '当前预设绑定的机型标识。', group: 'meta' },
  type: { label: '版本类型', desc: '标准版、快拆版或 Lite 版等。', group: 'meta' },
  _custom_name: { label: '显示名称', desc: '本地列表里看到的自定义名称。', group: 'meta' },
  _comment: { label: '发布时间备注', desc: '预设文件里的额外说明。', group: 'meta', multiline: true },
  'toolhead.speed_limit': { label: '涂胶速度限制', unit: 'mm/s', group: 'toolhead' },
  'toolhead.offset.x': { label: 'X 轴补偿', unit: 'mm', group: 'toolhead' },
  'toolhead.offset.y': { label: 'Y 轴补偿', unit: 'mm', group: 'toolhead' },
  'toolhead.offset.z': { label: 'Z 轴高度差', unit: 'mm', group: 'toolhead' },
  'toolhead.custom_mount_gcode': { label: '展开动作文本', type: 'gcode', group: 'mount' },
  'toolhead.custom_unmount_gcode': { label: '收起动作文本', type: 'gcode', group: 'unmount' },
  'wiping.have_wiping_components': { label: '使用擦嘴塔', type: 'boolean', group: 'wiping' },
  'wiping.wiper_x': { label: '擦嘴起点 X', unit: 'mm', group: 'wiping' },
  'wiping.wiper_y': { label: '擦嘴起点 Y', unit: 'mm', group: 'wiping' },
  'wiping.wipetower_speed': { label: '擦嘴塔速度', unit: 'mm/s', group: 'wiping' },
  'wiping.nozzle_cooling_flag': { label: '涂胶时降温', type: 'boolean', group: 'wiping' },
  'wiping.iron_apply_flag': { label: '缩小涂胶区域', type: 'boolean', group: 'wiping' },
  'wiping.user_dry_time': { label: '额外干燥时间', unit: '秒', group: 'wiping' },
  'wiping.force_thick_bridge_flag': { label: '强制厚桥', type: 'boolean', group: 'wiping' },
  'wiping.support_extrusion_multiplier': { label: '支撑挤出倍率', group: 'wiping' }
};

// 扁平化对象工具（递归把嵌套的 json 变成 a.b.c 格式）
export function flattenObject(ob) {
  const toReturn = {};
  for (const i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if ((typeof ob[i]) === 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
      const flatObject = flattenObject(ob[i]);
      for (const x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

// 还原嵌套对象工具
export function unflattenObject(ob) {
  const result = {};
  for (const i in ob) {
    const keys = i.split('.');
    keys.reduce(function(r, e, j) {
      return r[e] || (r[e] = isNaN(Number(keys[j + 1])) ? (keys.length - 1 === j ? ob[i] : {}) : []), r[e];
    }, result);
  }
  return result;
}

// 判断 G-code 行的类型
export function getGcodeLineHint(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return '空行';
  if (trimmed.startsWith(';')) return '注释';
  if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) return '运动';
  if (trimmed.startsWith('G92')) return '坐标重置';
  if (trimmed.startsWith('M106')) return '风扇';
  if (trimmed.startsWith('M204')) return '加速度';
  if (trimmed.startsWith('L8')) return '自定义宏';
  return '指令';
}