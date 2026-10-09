# Sergio Ambrosio · Portafolio de ingeniería estructural

Sitio estático bilingüe de ingeniería estructural: acero, concreto, minería, análisis avanzado, normativa aplicada y automatización con Python. Incluye proyectos profesionales, investigación, ocho notas técnicas y dos demostradores computacionales originales.

[Español](https://sergioambrosio714.github.io/) · [English](https://sergioambrosio714.github.io/en/index.html) · [Perfil de GitHub](https://github.com/SergioAmbrosio714)

## Editar contenido

El contenido mantenible está en `data/`. Edita ambas versiones lingüísticas y ejecuta el generador; las páginas generadas se incluyen en Git para que GitHub Pages las publique directamente.

| Fuente | Contenido |
| --- | --- |
| `data/profile.json` | Identidad, grado, experiencia, especialidades, formación, contactos y fotografía |
| `data/projects.json` | Proyectos profesionales, participación y alcance |
| `data/research.json` | Publicaciones, autores, títulos oficiales y evidencia documental |
| `data/insights.json` | Ocho notas técnicas, referencias y seguimiento normativo |
| `data/standards.json` | Catálogo normativo, estado de aplicación, ediciones consultadas y tres casos conceptuales |
| `data/automation.json` | Aplicaciones de programación, secuencias de trabajo y metadatos de los dos demostradores |
| `data/lab.json` y `data/lab-en.json` | Contenido ES/EN de Structural Lab |
| `scripts/build.py` | Generador principal: páginas, navegación, metadatos, CV y perfil de GitHub |
| `scripts/engineering_sections.py` | Plantillas de normativa, automatización y demostradores; las utiliza el generador principal |
| `styles.css`, `editorial.css`, `engineering.css` | Presentación general, artículos y nuevas secciones de ingeniería |
| `demo-core.js` | Cálculos y validación del navegador, con contrato equivalente al código Python |
| `demo-ui.js` | Importación local, controles, gráficos, tablas y descargas de demostración |
| `python/` | Programas Python, utilidades compartidas, ejemplos, pruebas y fixtures de comparación |
| `hero-model.js` | Modelo industrial interactivo original |
| `assets/` | Figuras, identidad visual y PDF públicos |

Los campos bilingües usan `{"es": "...", "en": "..."}`. Las fichas incluyen `id`, `slug`, `es`, `en`, `image` y `references`. Sus secciones admiten párrafos, listas, ecuaciones, tablas, enlaces `links` y fragmentos `code: {language, text}`. Los textos de datos son texto plano; el generador se ocupa del HTML. Conserva identificadores y rutas al actualizar una ficha.

Desde esta carpeta, con Python 3.12:

```powershell
python scripts/build.py
python scripts/build.py --check
python -m http.server 8000
```

Abre `http://localhost:8000/` o `http://localhost:8000/en/`. Detén el servidor con Ctrl+C. El primer comando genera páginas, `profile-data.js`, `sitemap.xml`, `cv/es.html`, `cv/en.html` y `data/image-manifest.json`; el segundo comprueba que coinciden con las fuentes sin modificarlas. Si existe la carpeta hermana `../github-profile/`, también genera su `README.md`. `scripts/engineering_sections.py` se carga desde `build.py`; no se ejecuta por separado.

El catálogo se publica en `normativa/index.html` y `en/normativa/index.html`. Los dos demostradores producen cuatro HTML:

| Demostrador | Español | English |
| --- | --- | --- |
| Resultados por nivel | `laboratorio/resultados-por-nivel.html` | `en/laboratorio/resultados-por-nivel.html` |
| Voladizo paramétrico | `laboratorio/voladizo-parametrico.html` | `en/laboratorio/voladizo-parametrico.html` |

Las fichas heredadas de `casos/` y `en/casos/` se conservan como páginas estáticas independientes. Sus cambios requieren editar esos archivos; los proyectos nuevos se mantienen en `data/projects.json`.

## Python y demostradores

La interfaz del navegador ejecuta **JavaScript**. Los programas descargables ejecutan **Python** por línea de comandos, con biblioteca estándar y Python 3.10 o posterior. No hay kernel Python en la página, servidor de cálculo ni conexión con la API de ETABS/SAP2000. El CSV importado se procesa localmente. Los datos de ejemplo y estos programas se desarrollaron para el portafolio en 2026; no se atribuyen a proyectos históricos.

Descarga o clona el directorio `python/` completo, conservando `_common.py` junto a los programas. Desde esta carpeta:

```powershell
python python/process_results.py python/examples/storey-results.csv --reference SERVICE_A --json results.json --csv results.csv
python python/cantilever.py python/examples/cantilever-scenarios.csv --samples 21 --json cantilever.json --csv cantilever.csv
```

Las salidas usan nombres distintos del archivo de entrada. Sin opciones de exportación, los programas imprimen JSON. Los archivos generados para una revisión local no deben añadirse al sitio por accidente. [La documentación Python](python/README.md) detalla esquema CSV, unidades, ecuaciones, límites, API y ejecución ES/EN.

El primer programa normaliza cotas/desplazamientos a metros y compara casos sobre los mismos niveles. Las diferencias requieren estados firmados simultáneos y compatibles: restar máximos independientes o resultados modales combinados no produce una deriva de diseño. El segundo resuelve un voladizo rectangular de Euler–Bernoulli; su razón de tensiones es descriptiva y no establece cumplimiento normativo.

Tras cambiar una fórmula o validación, actualiza Python y `demo-core.js` de forma coherente. Ejecuta pruebas independientes, regenera fixtures sólo si el cambio es intencional y comprueba la paridad con el código Python ejecutado de nuevo:

```powershell
python -m unittest discover -s python/tests -v
python python/build_fixtures.py
python python/build_fixtures.py --check
node tests/demo-core.test.cjs
```

Los fixtures en `python/fixtures/` conservan resultados y errores esperados; no son evidencia de obra. Si cambias CSV de ejemplo, ejecuta también `python scripts/build.py` para actualizar los datos incorporados a las páginas. Renueva las capturas de funcionamiento cuando cambie la interfaz o el ejemplo y conserva su procedencia.

La prueba de paridad utiliza `python` del PATH. Si el intérprete tiene otra ubicación, define `PYTHON` con la ruta al ejecutable, por ejemplo `$env:PYTHON = 'C:\ruta\python.exe'`, antes de ejecutar el test de Node.

## CV público

Primero regenera el HTML y luego imprime ambas versiones con Node.js 22 y Playwright/Chromium:

```powershell
python scripts/build.py
node scripts/render-cv.cjs
```

El resultado queda en `assets/cv-sergio-ambrosio-es.pdf` y `assets/cv-sergio-ambrosio-en.pdf`. El script requiere Playwright disponible como módulo; no instala paquetes. Si las herramientas están fuera del sitio, puedes indicar sus rutas. Este ejemplo usa las herramientas locales del paquete de trabajo:

```powershell
$env:PLAYWRIGHT_MODULE = (Resolve-Path '../.tools/playwright-core/package').Path
$env:BROWSER_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
& '../.tools/node.exe' scripts/render-cv.cjs
```

En otra máquina adapta esas rutas o usa una instalación local de Playwright con su Chromium. Revisa los PDF, sus enlaces, saltos de página y contenido antes de incluirlos en un commit. Los datos profesionales provienen de `profile.json`, `projects.json` y `research.json`; corrige allí las fuentes para conservar consistencia entre web, CV y perfil.

## Fotografías y procedencia de figuras

Actualmente `profile.portrait` es `null`: el sitio muestra un monograma. Para incorporar una fotografía real y autorizada, añade el archivo a `assets/` y sustituye ese valor por un objeto con `src` y `caption` bilingüe. Se recomienda una proporción 4:5. Conserva además su autoría y condiciones de uso en el objeto; no utilices una identidad fotográfica inventada.

Cada figura de proyecto, investigación o nota documenta:

| Campo | Información |
| --- | --- |
| `src` | Ruta relativa al archivo |
| `source` | Autoría, procedencia o fuente, en ES/EN |
| `software` | Herramienta realmente utilizada, por ejemplo SVG |
| `date` | Fecha documentada, formato YYYY-MM-DD |
| `description` | Descripción factual de lo que representa, en ES/EN |
| `usage` | Autorización, alcance y carácter conceptual, en ES/EN |
| `caption` | Pie de figura que explica su lectura, en ES/EN |
| `width`, `height` | Dimensiones intrínsecas |

El texto alternativo pertenece a `es.imageAlt` y `en.imageAlt`. `data/image-manifest.json` se genera a partir de estas fichas: no se edita directamente. Una ilustración conceptual debe identificarse como tal y diferenciarse de resultados calculados, fotografías y capturas reales. Las figuras actuales son originales; no reproducen gráficas de publicaciones ni acreditan resultados de una obra.

## Fuentes y revisión técnica

Las publicaciones conservan títulos oficiales, autoría y enlaces a sus documentos o registros. Las referencias usan `title` y, cuando corresponde, `note` en ES/EN, además de una URL. Las notas técnicas enlazan fuentes primarias de organismos, autores institucionales o fabricantes; distinguen normas, guías, documentación de software y material metodológico.

En `data/standards.json`, `referenceEdition` identifica la edición consultada y `referenceVerified` su verificación documental. `practice` distingue `declared` (aplicación declarada), `reference` (referencia complementaria) y `pending` (aplicación personal por confirmar). No conviertas una edición consultada recientemente en una edición utilizada en una obra anterior. Las relaciones con proyectos y los tres recorridos de diseño conservan su alcance explícito; E.090 sigue pendiente de confirmación personal.

Al actualizar una nota, registra edición/año, fecha de revisión, supuestos, unidades y alcance del ejemplo. Verifica cálculos manuales sencillos antes de presentar cifras. No conviertas ejemplos educativos en resultados atribuidos a proyectos. En novedades normativas, separa disposiciones aprobadas, propuestas, modificaciones transitorias y erratas; una fecha de consulta no es una nueva edición.

El corte documental de estas notas es el 8 de octubre de 2026. Las fuentes enlazadas permiten revisar su vigencia y aplicabilidad. La identidad profesional utiliza el título de Ingeniero Civil de la UNI; una traducción no añade una licencia PE ni una colegiatura no documentada. El CV público excluye dirección domiciliaria, documentos de identidad, teléfono personal y datos personales de terceros.

## Verificación

Estas comprobaciones no requieren paquetes de navegador:

```powershell
python scripts/build.py --check
python -m unittest discover -s python/tests -v
python python/build_fixtures.py --check
node --check app.js
node --check hero-model.js
node --check navigation.js
node --check profile-data.js
node --check demo-core.js
node --check demo-ui.js
node tests/demo-core.test.cjs
node tests/smoke.test.cjs
node tests/links.test.cjs
node tests/content.test.cjs
```

Las pruebas de navegador añaden revisión de escritorio/móvil, interacción del modelo, navegación, ausencia de JavaScript y accesibilidad con axe. La prueba de demostradores revisa además importación, errores, comparación de casos, controles y exportaciones:

```powershell
node tests/browser.test.cjs
node tests/demo-browser.test.cjs
```

Requiere Playwright y axe-core. `PLAYWRIGHT_MODULE` selecciona el módulo, `BROWSER_PATH` permite usar Chrome/Edge instalado, `AXE_PATH` señala `axe.min.js` y `QA_SCREENSHOTS` define dónde guardar capturas e informe. Mantén dependencias e informes fuera del sitio. El workflow `.github/workflows/ci.yml` documenta las versiones y ejecuta las comprobaciones en GitHub Actions. Una prueba de accesibilidad automatizada complementa la revisión manual con teclado y lectura.

## Publicación y actualizaciones

Este repositorio corresponde a `SergioAmbrosio714/SergioAmbrosio714.github.io`. GitHub Pages publica desde `main`, carpeta `/(root)`; el workflow de CI valida el contenido. El perfil pertenece a otro repositorio: `SergioAmbrosio714/SergioAmbrosio714`.

Después de editar datos, regenerar páginas/PDF y superar las pruebas, revisa `git status` y `git diff`. Añade sólo los cambios revisados, crea un commit y realiza un push normal a `origin main`. Integra avances remotos antes de publicar; conserva el historial y las credenciales fuera de archivos o URLs.

Si trabajas con el paquete completo, `../PUBLICAR.md` y `../tools/publish_github.py` describen la comprobación y publicación coordinadas de ambos repositorios. Esas herramientas externas no forman parte del sitio. En un clon independiente, publica cada repositorio con Git y revisa las ejecuciones de Actions y Pages.

Comprueba después la portada ES/EN, catálogo normativo, cuatro páginas de demostración, fichas modificadas, código/ejemplos descargables, PDF y enlaces del perfil en sus URL públicas. Un push confirmado no demuestra por sí solo que la versión nueva ya se haya desplegado.
