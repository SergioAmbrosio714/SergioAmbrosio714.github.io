# Python · Structural engineering demonstrations

[Español](#español) · [English](#english)

## Español

Código original preparado para el portafolio de Sergio Ambrosio en 2026. Los CSV son **datos sintéticos**; no proceden de proyectos profesionales ni de una conexión con ETABS o SAP2000. Estas dos demostraciones se distinguen de las rutinas utilizadas anteriormente en la práctica profesional. No se atribuyen ahorros de tiempo ni resultados de proyectos a este código.

El portafolio ofrece una interfaz ligera que ejecuta cálculos equivalentes en **JavaScript**. Este directorio contiene las herramientas **Python** ejecutables por línea de comandos. No hay un intérprete Python en el navegador, servidor de cálculo, API comercial ni conexión automática con programas de análisis. Los archivos importados en la interfaz se procesan localmente en el navegador.

### Ejecutar y verificar

Requisito: Python 3.10 o posterior. Sólo biblioteca estándar; no hay paquetes que instalar. Descargue el directorio `python/` completo desde el repositorio, conservando `_common.py` junto a los dos programas. Los siguientes comandos se ejecutan desde la raíz del repositorio:

```sh
python python/process_results.py python/examples/storey-results.csv --reference SERVICE_A --json results.json --csv results.csv
python python/cantilever.py python/examples/cantilever-scenarios.csv --samples 21 --json cantilever.json --csv cantilever.csv
python -m unittest discover -s python/tests -v
python python/build_fixtures.py --check
```

En Windows también puede emplearse `py -3` en lugar de `python`. Sin `--json` ni `--csv`, el programa escribe JSON en la salida estándar. Una entrada inválida devuelve código de salida `2`, explica el error y no comienza la exportación. Los nombres de entrada y salida deben ser distintos. Cada archivo se reemplaza de manera atómica; si hay varias salidas, no constituyen una transacción conjunta.

Para actualizar ejemplos de comparación tras un cambio intencional: `python python/build_fixtures.py`. No sustituye las pruebas independientes. Los fixtures generados conservan una interfaz de datos estable, `schema_version: 1`.

### 01 · Procesamiento de resultados por nivel

Problema: convertir desplazamientos firmados a unidades comunes, verificar que los casos describen los mismos niveles y comparar sus respuestas. El importador acepta una tabla documentada; una exportación de ETABS/SAP2000 debe adaptarse expresamente a este esquema. No reconoce automáticamente su formato nativo.

| Columna CSV obligatoria | Significado |
| --- | --- |
| `case` | Identificador del caso o estado de respuesta |
| `level` | Identificador del nivel |
| `elevation` | Cota, positiva o negativa |
| `displacement` | Desplazamiento firmado en una misma dirección, punto y sistema de coordenadas |
| `elevation_unit` | `m`, `cm` o `mm` |
| `displacement_unit` | `m`, `cm` o `mm` |

CSV UTF-8, delimitador coma, punto decimal, notación científica admitida, sin separador de miles. Puede haber BOM y terminaciones CRLF. Las seis columnas son obligatorias; el orden puede variar. Unidades compatibles pueden mezclarse explícitamente por fila. No se aceptan unidades angulares, fuerzas, unidades omitidas ni valores no finitos. La capitalización importa: `mm` es válido, `MM` no.

Los identificadores tienen de 1 a 64 caracteres ASCII, empiezan con letra o dígito y admiten letras, números, espacio y `_. /()+-`. Se rechazan controles y prefijos de fórmula como `=`, `+`, `-` o `@`, evitando que etiquetas importadas se ejecuten como fórmulas al exportar CSV. Los números se interpretan estrictamente y se exportan como números, nunca como expresiones. Límite: **2 MiB y 5.000 filas de datos**.

Cada caso necesita al menos dos niveles, sin pares caso/nivel repetidos ni cotas repetidas. Todos los casos deben compartir niveles y cotas. Tolerancia de comparación de cotas en metros: `max(1e-9, 1e-9 × max(|z₁|, |z₂|))`; después se utiliza la geometría del caso de referencia. Los niveles se ordenan por cota y los casos por identificador. Por defecto, la referencia es el primer caso en orden lexicográfico; puede elegirse mediante `--reference`.

Para niveles consecutivos, `hᵢ = zᵢ − zᵢ₋₁`, `Δuᵢ = uᵢ − uᵢ₋₁` y `θᵢ = Δuᵢ / hᵢ`. La diferencia entre casos es `u(caso) − u(referencia)` en cada nivel. En el primer nivel, altura entre pisos, desplazamiento relativo y deriva son `null` en JSON y celdas vacías en CSV: no se inventa un nivel inferior. Se informa el máximo valor absoluto, conservando el signo en los puntos.

El ejemplo contiene cotas 0, 3, 6 y 9 m. `SERVICE_A` tiene desplazamientos 0, 2, 6 y 12 mm; `SERVICE_B`, 0, 3, 8 y 15 mm. La deriva máxima es 0,002 para A y 7/3000 para B; la diferencia en el nivel superior es 3 mm. Son resultados aritméticos del ejemplo, **sin comparación con un límite normativo**.

**Alcance esencial:** las diferencias entre niveles requieren estados de respuesta coherentes y simultáneos, con la misma dirección, coordenadas, punto de control y convención de signos. No se pueden restar máximos independientes de una envolvente o desplazamientos modales combinados por SRSS/CQC para obtener una deriva de diseño. El programa no puede deducir esta condición a partir del CSV. No aplica factores de amplificación sísmica, torsión, combinaciones de carga ni límites de E.030/ASCE.

API: `process_results.process_csv(text, reference_case=None)`; también `process_rows(rows, reference_case=None)` y `export_csv(result)`. JSON: `demo`, `schema_version`, `reference_case`, `level_order`, `cases`. Cada caso incluye `case`, `max_abs_displacement_m`, `max_abs_drift_ratio` y `points`; cada punto contiene `level`, `elevation_m`, `displacement_m`, `storey_height_m`, `interstorey_displacement_m`, `drift_ratio`, `difference_from_reference_m`. El CSV procesado es una salida SI de análisis, no el esquema de entrada para reimportar directamente.

### 02 · Voladizo rectangular con carga puntual

Problema didáctico: comparar geometría, rigidez y carga de un miembro prismático lineal elástico, empotrado en `x = 0`, con carga puntual en `x = L`. Se emplea la teoría de Euler–Bernoulli, sección rectangular y pequeñas deformaciones.

| Columna CSV obligatoria | Unidad / condición |
| --- | --- |
| `scenario` | Identificador seguro, único |
| `length_m` | Longitud `L > 0`, m |
| `width_m` | Ancho `b > 0`, m |
| `depth_m` | Canto en el plano de flexión `h > 0`, m |
| `elastic_modulus_pa` | Módulo elástico `E > 0`, Pa |
| `tip_load_n` | Carga puntual firmada `P`, N; cero es válido |
| `reference_stress_pa` | Tensión de comparación aportada por el usuario, positiva, Pa |

Convención: carga y desplazamiento descendentes positivos, giro `dv/dx` positivo; momento externo horario positivo. Las reacciones son `R = −P` y `M₀ = −PL`. Los diagramas internos se definen como `V(x) = P` y `M(x) = P(L − x)`, de modo que `dM/dx = −V` y `EI v″ = M`. El cortante del punto final es el límite **interior** junto a la carga; su salto al exterior no se muestrea.

```text
A = b h                     I = b h³ / 12
v(x) = P x² (3L − x) / (6 E I)
θ(x) = P x (2L − x) / (2 E I)
v(L) = P L³ / (3 E I)       θ(L) = P L² / (2 E I)
σ(x) = M(x) (h/2) / I       |σ|max = |P L| (h/2) / I
ratio = |σ|max / tensión_de_referencia
```

El signo de `σ(x)` corresponde a una fibra extrema de referencia; la fibra opuesta tiene signo contrario. El cociente de tensiones es sólo una comparación elástica. **No es una utilización normativa, resistencia de diseño ni indicador de aprobación**. No incluye factores de resistencia, pandeo, pandeo lateral torsional, plastificación, cortante, conexiones, fatiga, interacción axial, vibración ni límites de servicio.

Ejemplo base: `L = 2 m`, `b = 0,1 m`, `h = 0,2 m`, `E = 200 GPa`, `P = 10 kN`, tensión de referencia `250 MPa`. Resultados: `I = 1/15000 m⁴`, desplazamiento final `2 mm`, giro `0,0015 rad`, tensión extrema máxima `30 MPa` y cociente `0,12`.

Los otros escenarios prueban mitad de carga, doble módulo y doble canto. `DOUBLE_E = 400 GPa` es una sensibilidad matemática, **no la especificación de un acero comercial**. `DOUBLE_DEPTH` reduce `L/h` a 5: puede aumentar la importancia de la deformación por cortante, que este modelo omite. El cálculo no certifica la aplicabilidad de Euler–Bernoulli ni verifica esbeltez; hay que revisar la hipótesis antes de extrapolar al proyecto.

API: `cantilever.analyze_csv(text, samples=21)`, `analyze_rows(rows, samples=21)`, `analyze_scenario(row, samples=21)` y `export_csv(result)`. Se admiten de 2 a 1001 estaciones por escenario. JSON: `demo`, `schema_version`, `samples`, `scenarios`. Cada escenario tiene `scenario`, `input`, `section`, `summary`, `points`. El CSV exporta `scenario,x_m,shear_n,moment_nm,displacement_m,rotation_rad,extreme_fibre_stress_pa`. Las claves y unidades completas figuran en `fixtures/cantilever.json`.

### Evidencia de verificación

Las pruebas no se limitan a comparar el programa consigo mismo: incluyen resultados manuales con fracciones exactas, equilibrio global y de secciones, condiciones de borde, trabajo virtual con integración numérica independiente, derivada de energía de Castigliano, relaciones diferenciales y propiedades de escala. También verifican conversiones, perfiles, signos, límites de archivo, valores no finitos, fórmulas CSV, ejecución CLI y protección de archivos de entrada.

`fixtures/validation-cases.json` conserva CSV crudos inválidos y el código de error esperado para comparar la implementación de navegador. `ValidationError.code` puede ser: `invalid_csv`, `missing_field`, `empty_data`, `file_limit`, `row_limit`, `invalid_identifier`, `invalid_number`, `unsupported_unit`, `duplicate_case_level`, `duplicate_elevation`, `incompatible_profile`, `insufficient_levels`, `invalid_reference`, `duplicate_scenario`, `invalid_samples`, `numeric_range`, `output_path_conflict`. Las interfaces pueden traducir el mensaje sin cambiar esos códigos.

Las capturas de funcionamiento se publican en la ficha del laboratorio del portafolio. Los fixtures no son datos de obra, capturas de programas comerciales ni prueba de una herramienta utilizada en un contrato profesional.

## English

Original code prepared for Sergio Ambrosio's portfolio in 2026. The CSV files contain **synthetic demonstration data**. They are not professional project results and are not obtained through a live ETABS or SAP2000 connection. These newly created examples are separate from previously developed professional tools; no project deployment or time savings are claimed.

The website's lightweight interface runs equivalent calculations in **JavaScript**. This directory contains real **Python command-line programs**. There is no browser Python kernel, calculation backend, commercial API or automatic connection to analysis software. Browser imports are processed locally.

### Run and verify

Use Python 3.10 or later. Only the standard library is required. Download the whole `python/` directory, keeping `_common.py` beside both programs. Run from the repository root:

```sh
python python/process_results.py python/examples/storey-results.csv --reference SERVICE_A --json results.json --csv results.csv
python python/cantilever.py python/examples/cantilever-scenarios.csv --samples 21 --json cantilever.json --csv cantilever.csv
python -m unittest discover -s python/tests -v
python python/build_fixtures.py --check
```

On Windows, `py -3` can replace `python`. Without output flags, JSON is written to standard output. Invalid input returns exit code `2` with a diagnostic before exports begin. Input and output paths must differ. Each output is replaced atomically; multiple outputs are not a single transaction. Regenerate fixtures after intentional changes with `python python/build_fixtures.py`; independent tests must still pass. JSON interface version: `schema_version: 1`.

### 01 · Storey result processing

Purpose: normalize signed displacements to SI, check matching storey profiles and compare response cases. Adapt commercial-software exports explicitly to the documented schema; this tool does not infer their native format.

Required CSV columns: `case,level,elevation,displacement,elevation_unit,displacement_unit`. Column order may vary. Elevations and displacements are signed numbers; length units must be exactly `m`, `cm` or `mm`. Compatible units may be mixed explicitly by row. All cases must use the same response direction, control point, coordinate system and sign convention.

CSV must use UTF-8, commas and a decimal point; scientific notation, BOM and CRLF are supported. Thousands separators, missing/extra fields, nonfinite values, unknown units and non-length units are rejected. Labels must contain 1–64 ASCII characters, start with a letter/digit and otherwise use letters, digits, spaces or `_. /()+-`. Control characters and spreadsheet formula prefixes `=`, `+`, `-`, `@` are rejected. Numbers are strictly parsed and exported numerically. Limits: **2 MiB and 5,000 data rows**.

Each case requires at least two levels with unique identifiers and elevations. Cases must share the same level set and elevations. SI elevation matching tolerance is `max(1e-9, 1e-9 × max(|z₁|, |z₂|))`; the reference geometry is used after this check. Levels are sorted by elevation; cases are sorted lexically. The default reference is the first case, or the case specified with `--reference`.

For adjacent levels, `hᵢ = zᵢ − zᵢ₋₁`, `Δuᵢ = uᵢ − uᵢ₋₁`, and drift ratio `θᵢ = Δuᵢ/hᵢ`. Case comparisons report `u(case) − u(reference)` at each level. At the first level, storey height, interstorey displacement and drift are `null` in JSON and empty in CSV because no lower level is supplied. Summary maxima use absolute values; sampled values retain their signs.

The example elevations are 0, 3, 6 and 9 m. `SERVICE_A` displacements are 0, 2, 6 and 12 mm; `SERVICE_B` values are 0, 3, 8 and 15 mm. Maximum drift ratios are 0.002 and 7/3000 respectively; the top-level displacement difference is 3 mm. **No code acceptance limit is applied.**

**Essential limitation:** interstorey differences require coherent, simultaneous signed response states. Subtracting independent envelope maxima or SRSS/CQC-combined modal displacement maxima does not produce a valid design drift. The CSV cannot establish this prerequisite. No seismic amplification factors, torsion, load combinations or E.030/ASCE limits are applied.

API: `process_results.process_csv(text, reference_case=None)`, `process_rows(rows, reference_case=None)`, `export_csv(result)`. JSON contains `demo`, `schema_version`, `reference_case`, `level_order`, `cases`. Each case contains `case`, `max_abs_displacement_m`, `max_abs_drift_ratio`, `points`; each point contains `level`, `elevation_m`, `displacement_m`, `storey_height_m`, `interstorey_displacement_m`, `drift_ratio`, `difference_from_reference_m`. Exported CSV is an SI analysis output, not a directly re-importable copy of the input schema.

### 02 · Rectangular cantilever with an end point load

Compare geometry, stiffness and loading for a prismatic, linearly elastic member fixed at `x = 0` with a point load at `x = L`. The idealization uses Euler–Bernoulli theory, a rectangular section and small deformations.

Required columns: `scenario,length_m,width_m,depth_m,elastic_modulus_pa,tip_load_n,reference_stress_pa`. The scenario identifier must be unique and follow the safe-label rules above. Length `L`, width `b`, bending depth `h`, Young's modulus `E` and the user-supplied reference stress must be positive finite values. The point load `P` can have either sign or be zero. All units are SI as indicated in the column names.

Downward force and displacement are positive; rotation is `dv/dx`; clockwise external moment is positive. Reactions are `R = −P`, `M₀ = −PL`. Internal diagrams are defined as `V(x) = P`, `M(x) = P(L − x)`, hence `dM/dx = −V` and `EI v″ = M`. The sampled tip shear is the **interior one-sided value**; the concentrated-load jump outside the member is not sampled.

```text
A = b h                     I = b h³ / 12
v(x) = P x² (3L − x) / (6 E I)
θ(x) = P x (2L − x) / (2 E I)
v(L) = P L³ / (3 E I)       θ(L) = P L² / (2 E I)
σ(x) = M(x) (h/2) / I       |σ|max = |P L| (h/2) / I
ratio = |σ|max / user_supplied_reference_stress
```

The signed stress represents one extreme reference fibre; the opposite fibre has the opposite sign. The stress ratio is **an elastic comparison, not code utilization, design resistance or approval**. It omits strength factors, buckling, lateral torsional buckling, yielding, shear deformation, connections, fatigue, axial interaction, vibration and serviceability limits.

Base example: `L = 2 m`, `b = 0.1 m`, `h = 0.2 m`, `E = 200 GPa`, `P = 10 kN`, reference stress `250 MPa`. Results: `I = 1/15000 m⁴`, tip displacement `2 mm`, tip rotation `0.0015 rad`, maximum extreme-fibre stress `30 MPa`, ratio `0.12`.

Other scenarios use half the load, twice the modulus and twice the depth. `DOUBLE_E = 400 GPa` illustrates mathematical sensitivity, **not a commercial steel grade**. `DOUBLE_DEPTH` reduces `L/h` to 5, where neglected shear deformation may matter. The tool does not verify slenderness or certify applicability of Euler–Bernoulli assumptions; check them before applying a result to a real member.

API: `cantilever.analyze_csv(text, samples=21)`, `analyze_rows(rows, samples=21)`, `analyze_scenario(row, samples=21)`, `export_csv(result)`. Use 2–1001 stations per scenario. JSON contains `demo`, `schema_version`, `samples`, `scenarios`; each scenario includes `scenario`, `input`, `section`, `summary`, `points`. Exported CSV columns are `scenario,x_m,shear_n,moment_nm,displacement_m,rotation_rad,extreme_fibre_stress_pa`. See `fixtures/cantilever.json` for complete field names and units.

### Verification evidence

Tests include exact-fraction reference values, global and section equilibrium, boundary conditions, independent numerical virtual-work integration, Castigliano's energy derivative, differential relationships and parameter scaling. They also test unit conversion, profile consistency, signs, file limits, nonfinite values, CSV formula protection, actual CLI execution and input-file preservation.

`fixtures/validation-cases.json` provides raw invalid CSV inputs and stable expected error codes for browser parity tests. `ValidationError.code` values are: `invalid_csv`, `missing_field`, `empty_data`, `file_limit`, `row_limit`, `invalid_identifier`, `invalid_number`, `unsupported_unit`, `duplicate_case_level`, `duplicate_elevation`, `incompatible_profile`, `insufficient_levels`, `invalid_reference`, `duplicate_scenario`, `invalid_samples`, `numeric_range`, `output_path_conflict`. User interfaces may translate messages while preserving codes.

Operational screenshots appear on the portfolio laboratory page. These fixtures do not represent construction records, commercial software screenshots or evidence of use on a professional contract.
