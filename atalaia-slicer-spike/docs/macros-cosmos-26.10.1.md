# Macros do COSMOS (leitura via Moonraker, GET only)

Firmware: OpenCentauri Cosmos 26.10.1 · AFC 1.2.7 · 4 pistas (CANVAS_1..4)

Extraído de `/printer/objects/query?configfile`. Texto integral, sem alterações.

## PRINT_START
```gcode
{% set target_bed = params.BED|int %}
{% set target_extruder = params.EXTRUDER|int %}
{% set target_chamber = params.CHAMBER|int %}
{% set tool = params.TOOL|default(0)|int %}
{% set global = printer['gcode_macro _global_var'] %}
{% set sensor = printer[global.runout_sensor_name] if global.runout_sensor_name in printer else none %}
{% set settings = printer['gcode_macro _COSMOS_SETTINGS']|default({}) %}
{% set heatsoak = settings.heatsoak|default(1)|float %}
{% set adaptive_mesh = settings.adaptive_mesh|default('false')|lower == 'true' %}
{% set adaptive_purge = settings.adaptive_purge|default('true')|lower == 'true' %}
{% set nozzle_z_homing = settings.nozzle_z_homing|default('false')|lower == 'true' %}
{% set toolhead_led = settings.toolhead_led|default('false')|lower == 'true' %}
{% set all_calibrated = printer["gcode_macro _CHECK_CALIBRATION_VARS"].all_calibrated %}

{% if not all_calibrated %}
SET_DISPLAY_TEXT MSG="Calibration process not completed. Please complete initial calibration first"
CANCEL_PRINT
RETURN
{% endif %}

{% if "AFC" in printer and "TOOL" not in params %}
RESPOND TYPE=error MSG="Multicolor is only properly supported when using the COSMOS AFC slicer profile. Please slice future prints with the correct profile."
{% endif %}

SET_GCODE_VARIABLE MACRO=_global_var VARIABLE=target_extruder VALUE={target_extruder}

{% if sensor and ("AFC" not in printer) and sensor.enabled and not sensor.filament_detected %}
SET_DISPLAY_TEXT MSG="NO FILAMENT LOADED!"
CANCEL_PRINT
RETURN
{% endif %}

{% if toolhead_led %}
SET_LED LED=hotend WHITE=1
{% endif %}

TURN_OFF_FANS
BED_MESH_CLEAR
CLEAR_PAUSE
G90
M140 S{target_bed}
M104 S{global.extruder_temp.probing}
G28

{% if nozzle_z_homing %}
SET_DISPLAY_TEXT MSG="Cleaning nozzle"
CLEAN_NOZZLE TARGET={global.extruder_temp.cleaning}
MOVE_TO_TRAY
M106 S255
CLEAN_NOZZLE TARGET={global.extruder_temp.probing}
{% endif %}

{% if target_chamber > 0 %}
M191 S{target_chamber}
{% endif %}
M190 S{target_bed}


SET_DISPLAY_TEXT MSG="Heatsoak: {heatsoak}m"
G4 P{(heatsoak * 60 * 1000)|int}

{% if nozzle_z_homing %}
LOADCELL_Z_HOME
{% endif %}

{% if adaptive_mesh %}
{% if not nozzle_z_homing %}
SET_DISPLAY_TEXT MSG="Adaptive bed mesh requires nozzle z homing. Please enable nozzle z homing."
CANCEL_PRINT
RETURN
{% endif %}

M109 S{global.extruder_temp.probing}
SET_DISPLAY_TEXT MSG="Creating adaptive bed mesh"
SET_GCODE_OFFSET Z=0
BED_MESH_CALIBRATE_BASE ADAPTIVE=1
G90
G1 Z5 F3000
{% else %}
{% if "default" in printer.bed_mesh.profiles %}
SET_DISPLAY_TEXT MSG="Using default bed mesh"
BED_MESH_PROFILE LOAD=default
{% else %}
SET_DISPLAY_TEXT MSG="NO BED MESH!"
CANCEL_PRINT
RETURN
{% endif %}
{% endif %}

{% if "AFC" in printer %}
T{tool}
{% endif %}

M104 S{target_extruder}

{% if adaptive_purge %}
SMART_PARK
{% endif %}

M109 S{target_extruder}

{% if adaptive_purge %}
LINE_PURGE
{% endif %}
SET_TEMPERATURE_FAN_TARGET temperature_fan=mainboard TARGET=30
LOAD_SKEW_IF_EXISTS
SET_DISPLAY_TEXT
G90
```

## PRINT_END
```gcode
{% set global = printer['gcode_macro _global_var'] %}
{% set settings = printer['gcode_macro _COSMOS_SETTINGS']|default({}) %}
{% set z_max = global.z_maximum_lifting_distance|int %}
{% set unload_after_print = settings.unload_after_print|default('false')|lower == 'true' %}
{% set z_ideal = settings.z_ideal_lifting_distance|default(170)|int %}
{% set toolhead_led = settings.toolhead_led|default('false')|lower == 'true' %}
{% set e_mintemp  = printer.configfile.settings['extruder'].min_extrude_temp %}
{% set sensor = printer[global.runout_sensor_name] if global.runout_sensor_name in printer else none %}
{% set cancel = params.CANCEL|default('false')|lower == 'true' %}
{% set clean_nozzle_after_print = settings.clean_nozzle_after_print|default('false')|lower == 'true' %}

CLEAR_SKEW_IF_EXISTS
RESET_VELOCITY_LIMIT
M220 S100
M221 S100

{% if printer.toolhead.homed_axes|lower == "xyz" %}
G91
{% if (not sensor) or ((not sensor.enabled) or sensor.filament_detected) %}
{% if (printer.extruder.target != 0 and (printer.extruder.temperature + 5) >= printer.extruder.target and printer.extruder.temperature >= e_mintemp) %}
M83
G1 E-{global.retract_end} F300

{% set x = -2 if printer.gcode_move.position.x > 128 else 2 %}
{% set y = -2 if printer.gcode_move.position.y > 128 else 2 %}

G1 X{x} Y{y} E-2 F6000
{% endif %}
{% endif %}

{% if ((printer.gcode_move.position.z + 10) < z_ideal) %}
G1 Z+{(z_ideal - printer.gcode_move.position.z)} F3000
{% elif (printer.gcode_move.position.z + 10) < z_max %}
G1 Z+10 F3000
{% else %}
G1 Z+{(z_max - printer.gcode_move.position.z)} F3000
{% endif %}

{% if ((not sensor) or ((not sensor.enabled) or sensor.filament_detected)) and not cancel %}
{% if (printer.extruder.target != 0 and (printer.extruder.temperature + 5) >= printer.extruder.target and printer.extruder.temperature >= e_mintemp) %}
{% if unload_after_print %}
UNLOAD_FILAMENT
{% endif %}
{% endif %}
{% endif %}

{% if cancel %}
G28 XY
{% endif %}

MOVE_TO_TRAY

{% if clean_nozzle_after_print and ((not cancel) or printer.extruder.temperature >= global.extruder_temp.cleaning) %}
M104 S0
SET_DISPLAY_TEXT MSG="Cleaning nozzle"
CLEAN_NOZZLE TARGET={global.extruder_temp.cleaning}
MOVE_TO_TRAY
SET_DISPLAY_TEXT
{% endif %}
{% endif %}
TURN_OFF_FANS
TURN_OFF_HEATERS
CLEAR_PAUSE
M84

{% if toolhead_led %}
SET_LED LED=hotend WHITE=0
{% endif %}

SET_GCODE_VARIABLE MACRO=_global_var VARIABLE=target_extruder VALUE=0
```

## M106
rename_existing: `M006`
```gcode
{% set index = params.P|default(1)|int %}
{% set speed = params.S|default(255)|int %}
{% set nspeed = speed/255 %}

{% if index == 1 %}
M006 S{speed}
{% elif index == 2 and 'fan_generic aux_fan' in printer %}
SET_FAN_SPEED FAN=aux_fan SPEED={nspeed}
{% elif index == 3 and 'fan_generic case_fan' in printer %}
SET_FAN_SPEED FAN=case_fan SPEED={nspeed}
{% else %}
RESPOND TYPE=error MSG="Invalid fan index {index}"
{% endif %}
```

## M107
rename_existing: `M007`
```gcode
{% set index = params.P|default(1)|int %}
M106 P{index} S0
```

## PAUSE
description: `Pause the actual running print`
rename_existing: `PAUSE_BASE`
```gcode
{% set global = printer['gcode_macro _global_var'] %}
{% set state = params.STATE|default('normal') %}
{% set emergency = params.EMERGENCY|default('false')|lower == 'true' %}
{% set retract_amount = global.retract_amount|float %}
{% set z_lift_max = global.z_maximum_lifting_distance|int %}
{% set sensor = printer[global.runout_sensor_name] if global.runout_sensor_name in printer else none %}
{% set pos = printer.gcode_move.position %}

{% if printer.pause_resume.is_paused %}
RESPOND MSG="Printer already paused"
RETURN
{% endif %}

SET_DISPLAY_TEXT MSG="Pausing"


CLEAR_SKEW_IF_EXISTS

_SAVE_FAN_STATE
PAUSE_BASE
TURN_OFF_FANS

{% if ((printer.extruder.temperature + 5) >= printer.extruder.target) and printer.extruder.can_extrude and ((not sensor) or ((not sensor.enabled) or sensor.filament_detected))  %}
M83
G1 E-{retract_amount} F300
{% endif %}

{% if printer.toolhead.homed_axes|lower == "xyz" %}
{% set zpos = printer.gcode_move.position.z %}
G91
{% if (zpos + 5) < z_lift_max %}
G1 Z+5 F3000
{% else %}
G1 Z+{(z_lift_max - zpos)} F3000
{% endif %}
G90
{% endif %}

{% if emergency %}
SET_DISPLAY_TEXT MSG="Emergency pause. Please check the printer and resume when ready."
M104 S{global.extruder_temp.probing}
RETURN
{% endif %}

{% if state == 'filament_change' %}
SET_DISPLAY_TEXT MSG="Paused for filament change"
UNLOAD_FILAMENT
LOAD_FILAMENT EXTRUDER_TEMP={printer.extruder.target}
{% elif state == 'runout' %}

RESPOND MSG="Paused for runout"
PURGE
LOAD_FILAMENT EXTRUDER_TEMP={printer.extruder.target}
{% else %}

M104 S{global.extruder_temp.probing}
MOVE_TO_TRAY
{% endif %}
```

## RESUME
description: `Resume the actual running print`
rename_existing: `RESUME_BASE`
variable_last_extruder_temp: `{'restore': False, 'temp': 0}`
variable_restore_idle_timeout: `0`
variable_idle_state: `False`
```gcode
{% set global = printer['gcode_macro _global_var'] %}
{% set sensor = printer[global.runout_sensor_name] if global.runout_sensor_name in printer else none %}
{% set extruder_target_temp = printer['gcode_macro _global_var'].target_extruder %}


{% if sensor and (sensor.enabled and not sensor.filament_detected) %}
RESPOND TYPE=command MSG="Please insert filament before resuming."
RETURN
{% endif %}
SET_DISPLAY_TEXT

MOVE_TO_TRAY
M109 S{extruder_target_temp}
M83
G1 E50 F300
KICK
_RESTORE_FAN_STATE

{% if "AFC" in printer %}
M400
SAVE_GCODE_STATE NAME=PAUSE_STATE
{% endif %}


LOAD_SKEW_IF_EXISTS

RESUME_BASE
```

## CANCEL_PRINT
description: `Cancel active print and park toolhead`
rename_existing: `CANCEL_PRINT_BASE`
```gcode
CANCEL_PRINT_BASE
PRINT_END CANCEL=true
```

## LINE_PURGE
description: `A purge macro that adapts to be near your actual printed objects`
```gcode
{% set travel_speed = (printer.toolhead.max_velocity) * 30 | float %}
{% set cross_section = printer.configfile.settings.extruder.max_extrude_cross_section | float %}


{% if printer.firmware_retraction is defined %}
{% set RETRACT = G10 | string %}
{% set UNRETRACT = G11 | string %}
{% else %}
{% set RETRACT = 'G1 E-.15 F2100' | string %}
{% set UNRETRACT = 'G1 E.5 F2100' | string %}
{% endif %}


{% set verbose_enable = printer["gcode_macro _KAMP_Settings"].verbose_enable | abs %}
{% set purge_height = printer["gcode_macro _KAMP_Settings"].purge_height | float %}
{% set tip_distance = printer["gcode_macro _KAMP_Settings"].tip_distance | float %}
{% set purge_margin = printer["gcode_macro _KAMP_Settings"].purge_margin | float %}
{% set purge_amount = printer["gcode_macro _KAMP_Settings"].purge_amount | float %}
{% set flow_rate = printer["gcode_macro _KAMP_Settings"].flow_rate | float %}



{% set all_points = printer.exclude_object.objects | map(attribute='polygon') | sum(start=[]) %}
{% set purge_x_min = (all_points | map(attribute=0) | min | default(0)) %}
{% set purge_x_max = (all_points | map(attribute=0) | max | default(0)) %}
{% set purge_y_min = (all_points | map(attribute=1) | min | default(0)) %}
{% set purge_y_max = (all_points | map(attribute=1) | max | default(0)) %}

{% set purge_x_center = ([((purge_x_max + purge_x_min) / 2) - (purge_amount / 2), 0] | max) %}
{% set purge_y_center = ([((purge_y_max + purge_y_min) / 2) - (purge_amount / 2), 0] | max) %}

{% set purge_x_origin = ([purge_x_min - purge_margin, 0] | max) %}
{% set purge_y_origin = ([purge_y_min - purge_margin, 0] | max) %}


{% set purge_move_speed = (flow_rate / 5.0) * 60 | float %}

{% if cross_section < 5 %}

{action_respond_info("[Extruder] max_extrude_cross_section is insufficient for purge, please set it to 5 or greater. Purge skipped.")}

{% else %}

{% if verbose_enable == True %}

{action_respond_info("Moving filament tip {}mms".format(
(tip_distance),
)) }
{% endif %}

{% if printer.firmware_retraction is defined %}
{action_respond_info("KAMP purge is using firmware retraction.")}
{% else %}
{action_respond_info("KAMP purge is not using firmware retraction, it is recommended to configure it.")}
{% endif %}

{% if purge_y_origin > 0 %}

{action_respond_info("KAMP purge starting at {}, {} and purging {}mm of filament, requested flow rate is {}mm3/s.".format(
(purge_x_center),
(purge_y_origin),
(purge_amount),
(flow_rate),
)) }

{% else %}

{action_respond_info("KAMP purge starting at {}, {} and purging {}mm of filament, requested flow rate is {}mm3/s.".format(
(purge_x_origin),
(purge_y_center),
(purge_amount),
(flow_rate),
)) }

{% endif %}

SAVE_GCODE_STATE NAME=Prepurge_State

{% if purge_y_origin > 0 %}

G92 E0
G0 F{travel_speed}
G90
G0 X{purge_x_center} Y{purge_y_origin}
G0 Z{purge_height}
M83
G1 E{tip_distance} F{purge_move_speed}
G1 X{purge_x_center + purge_amount} E{purge_amount} F{purge_move_speed}
{RETRACT}
G0 X{purge_x_center + purge_amount + 10} F{travel_speed}
G92 E0
M82
G0 Z{purge_height * 2} F{travel_speed}

{% else %}

G92 E0
G0 F{travel_speed}
G90
G0 X{purge_x_origin} Y{purge_y_center}
G0 Z{purge_height}
M83
G1 E{tip_distance} F{purge_move_speed}
G1 Y{purge_y_center + purge_amount} E{purge_amount} F{purge_move_speed}
{RETRACT}
G0 Y{purge_y_center + purge_amount + 10} F{travel_speed}
G92 E0
M82
G0 Z{purge_height * 2} F{travel_speed}

{% endif %}

RESTORE_GCODE_STATE NAME=Prepurge_State

{% endif %}
```

## SMART_PARK
description: `Parks your printhead near the print area for pre-print hotend heating.`
```gcode
{% set kamp_settings = printer["gcode_macro _KAMP_Settings"] %}
{% set z_height = kamp_settings.smart_park_height | float %}
{% set purge_margin = kamp_settings.purge_margin | float %}
{% set verbose_enable = kamp_settings.verbose_enable | abs %}
{% set center_x = printer.toolhead.axis_maximum.x / 2 | float %}
{% set center_y = printer.toolhead.axis_maximum.y / 2 | float %}
{% set axis_minimum_x = (printer.toolhead.axis_minimum.x | float) + 1 %}
{% set axis_minimum_y = (printer.toolhead.axis_minimum.y | float) + 1 %}
{% set all_points = printer.exclude_object.objects | map(attribute='polygon') | sum(start=[]) %}
{% set x_min = all_points | map(attribute=0) | min | default(center_x) %}
{% set y_min = all_points | map(attribute=1) | min | default(center_y) %}
{% set travel_speed = (printer.toolhead.max_velocity) * 30 | float %}

{% if purge_margin > 0 and x_min != center_x and y_min != center_y %}
{% set x_min = [ x_min - purge_margin , x_min ] | min %}
{% set y_min = [ y_min - purge_margin , y_min ] | min %}
{% set x_min = [ x_min , axis_minimum_x ] | max %}
{% set y_min = [ y_min , axis_minimum_y ] | max %}
{% endif %}


{% if verbose_enable == True %}

{ action_respond_info("Smart Park location: {},{}.".format(
(x_min),
(y_min),
)) }

{% endif %}

SAVE_GCODE_STATE NAME=Presmartpark_State

G90
{% if printer.toolhead.position.z < z_height %}
G0 Z{z_height}
{% endif %}
G0 X{x_min} Y{y_min} F{travel_speed}
G0 Z{z_height}

RESTORE_GCODE_STATE NAME=Presmartpark_State
```

## _COSMOS_SETTINGS
variable_sync_camera_led_to_chamber_led: `False`
variable_camera_led_default_on: `True`
variable_heatsoak: `1`
variable_adaptive_mesh: `False`
variable_adaptive_purge: `True`
variable_unload_after_print: `False`
variable_clean_nozzle_after_print: `True`
variable_nozzle_z_homing: `False`
variable_z_ideal_lifting_distance: `170`
variable_full_calibrate_hotend_temperature: `250`
variable_full_calibrate_bed_temperature: `60`
variable_bypass_calibration: `False`
variable_toolhead_led: `False`
```gcode

```

## _global_var
variable_target_extruder: `0`
variable_retract_amount: `2`
variable_retract_end: `5`
variable_extruder_temp: `{'probing': 140, 'cleaning': 200, 'loading': 230, 'purging': 250}`
variable_fan_states: `{'default': {'p1': 0.0, 'p2': 0.0, 'p3': 0.0}}`
variable_z_maximum_lifting_distance: `256`
variable_pause_resume_travel_speed: `150`
variable_z_bed_level: `-2`
variable_runout_sensor_name: `'filament_switch_sensor extruder_tool_start'`
variable_always_kick_during_purge: `False`
variable_purge_split_length: `100`
variable_purge_default_amount: `200`
```gcode

```

## T0..T3

Não são macros de configuração: `T0`..`T3` constam do `/printer/gcode/help` como
`change filaments in tool head` — são registados pelo módulo AFC (v1.2.7, 4 pistas CANVAS_1..4).
O `PRINT_START` chama `T{tool}` quando existe o objeto `AFC`, portanto a seleção de pista já está no macro.

## Leitura

- `PRINT_START` recebe 4 parâmetros usados a sério: `BED`, `EXTRUDER`, `CHAMBER`, `TOOL` (default 0).
  Sem `TOOL` e com AFC presente, avisa que multicolor exige o perfil COSMOS AFC.
- Sequência real: `G28` (homing) → [limpeza de bico se `nozzle_z_homing`] → [M191 se `CHAMBER>0`] →
  `M190` cama → heatsoak `G4` de `heatsoak` minutos (1 por omissão) → malha
  (adaptativa só com `nozzle_z_homing`; senão carrega o perfil `default`, e **cancela se não existir**) →
  `T{tool}` → `M104`/`M109` bico → `SMART_PARK` + `LINE_PURGE` (purga adaptativa ligada) → skew.
- Bloqueia a impressão se `all_calibrated` for falso: mostra mensagem e faz `CANCEL_PRINT`.
- `PRINT_END`: retrai, sobe a Z até 170 mm (`z_ideal_lifting_distance`), `MOVE_TO_TRAY`, limpeza de bico
  (ligada), desliga ventoinhas/aquecedores, `M84`.
- `M106` é macro: `P1`→ventoinha de arrefecimento (`M006`), `P2`→`aux_fan`, `P3`→`case_fan`
  (ventoinha da caixa, 0-255 convertida para 0-1). `P3` existe e é válido.
- `PAUSE`/`RESUME` são substituições (`rename_existing`) com retração, subida de 5 mm, parque no tabuleiro
  e reposição de ventoinhas; `RESUME` repõe a temperatura do bico e faz `KICK`.

## Comparação OrcaSlicer vs Android (mesmo perfil, objetos diferentes)

| Linha | OrcaSlicer (Cubo) | Android (Gengar) |
|---|---|---|
| `PRINT_START` | `EXTRUDER=210 BED=60 CHAMBER=0 TOOL=0` | `EXTRUDER=210 BED=35 CHAMBER=0 TOOL=0` |
| `M106 P3 S200` | presente | ausente |
| `T0` | presente | ausente |
| thumbnails | bloco 144x144 (base64) | 0 |
| cabeçalho | 1 `HEADER_BLOCK_END` | 2 `HEADER_BLOCK_END` (bug) |

- `M106 P3 S200` vem do `filament_start_gcode` condicional (`bed_temperature > 55`). Com `BED=35` a condição é
  falsa — a ausência é consequência da placa/cama, não do motor.
- `T0` é redundante: o `PRINT_START` já faz `T{tool}` com `TOOL=0` quando o AFC existe.
- Nada de obrigatório falta no G-code do Android para imprimir; faltam as miniaturas e o cabeçalho tem um
  `HEADER_BLOCK_END` duplicado.

## Mapeamento AFC (leitura GET, 17-11)

| Pista | Mapa | Material | Cor | Estado | Peso |
|---|---|---|---|---|---|
| CANVAS_1 | T1 | PLA | #E853BA (rosa) | Ready | 134 g |
| CANVAS_2 | **T0** | PLA | #00BCD4 (ciano) | Ready | **44 g** |
| CANVAS_3 | T2 | PLA | #FF9800 (laranja) | Ready | 152 g |
| CANVAS_4 | T3 | PLA | #0028B2 (azul) | **In Tool** | 133 g |

`PRINT_START TOOL=0` vai fazer o AFC descarregar o CANVAS_4 (T3, azul) e carregar o CANVAS_2 (T0, ciano).
Todas as pistas são PLA (210 °C válido). Nota: o CANVAS_2 só tem ~44 g.

**Spec E1 (produto):** o seletor de ranhuras deve ler `AFC_lane CANVAS_n` (`current_map`, `material`,
`color`, `filament_status`) e `AFC.current_load` por GET, em vez de assumir T0 = pista 1.
