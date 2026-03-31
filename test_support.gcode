; BambuStudio
; travel_speed = 300
; nozzle_diameter = 0.4
; initial_layer_print_height = 0.2
; layer_height = 0.2
; initial_layer_speed = 50
; retraction_length = 0.8
; nozzle_temperature = 220
; filament_settings_id = "PLA"
;===== machine: X1
; Z_HEIGHT: 0.2
G1 X100 Y100 F30000
; FEATURE: Outer wall
G1 X110 Y100 E0.05120
G1 X110 Y110 E0.05120
; Z_HEIGHT: 0.22
G1 X100 Y100 F30000
; FEATURE: Support interface
G1 X105 Y105 E0.02560
G1 X106 Y106 E0.02560
; FEATURE: Inner wall
G1 X100 Y100 E0.05120
; layer num 2
G1 X100 Y100 F30000
; Z_HEIGHT: 0.42
G1 X100 Y100 F30000
; FEATURE: Support interface
G1 X105 Y105 E0.02560
G1 X106 Y106 E0.02560
; FEATURE: Inner wall
G1 X100 Y100 E0.05120
; layer num 3
G1 X100 Y100 F30000
