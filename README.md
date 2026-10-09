# Sergio Ambrosio · Portafolio de ingeniería estructural

Sitio estático bilingüe de ingeniería estructural: acero, concreto, minería, edificaciones, análisis sísmico y modelación avanzada.

[Español](https://sergioambrosio714.github.io/) · [English](https://sergioambrosio714.github.io/en/index.html) · [Perfil de GitHub](https://github.com/SergioAmbrosio714)

## Editar contenido

El contenido mantenible está en `data/`. Edita ambas versiones lingüísticas y ejecuta el generador; las páginas generadas se incluyen en Git para que GitHub Pages las publique directamente.

| Fuente | Contenido |
| --- | --- |
| `data/profile.json` | Identidad, grado, experiencia, especialidades, formación, contactos y fotografía |
| `data/projects.json` | Proyectos profesionales, participación y alcance |
| `data/research.json` | Publicaciones, autores, títulos oficiales y evidencia documental |
| `data/insights.json` | Seis notas técnicas y seguimiento normativo |
| `data/lab.json` y `data/lab-en.json` | Contenido ES/EN de Structural Lab |
| `scripts/build.py` | Estructura HTML, navegación, metadatos y plantillas del CV/perfil |
| `styles.css` y `editorial.css` | Presentación visual |
| `hero-model.js` | Modelo industrial interactivo original |
| `assets/` | Figuras, identidad visual y PDF públicos |

Los campos bilingües usan `{"es": "...", "en": "..."}`. Las fichas incluyen `id`, `slug`, `es`, `en`, `image` y `references`. Sus secciones admiten párrafos, listas, ecuaciones de texto y tablas. Conserva los identificadores y las rutas al actualizar una ficha para mantener sus enlaces.

Desde esta carpeta, con Python 3.12:

```powershell
python scripts/build.py
python scripts/build.py --check
python -m http.server 8000
```

Abre `http://localhost:8000/` o `http://localhost:8000/en/`. Detén el servidor con Ctrl+C. El primer comando genera páginas, `profile-data.js`, `sitemap.xml`, `cv/es.html`, `cv/en.html` y `data/image-manifest.json`; el segundo comprueba que coinciden con las fuentes sin modificarlas. Si existe la carpeta hermana `../github-profile/`, también genera su `README.md`.

Las fichas heredadas de `casos/` y `en/casos/` se conservan como páginas estáticas independientes. Sus cambios requieren editar esos archivos; los proyectos nuevos se mantienen en `data/projects.json`.

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

Al actualizar una nota, registra edición/año, fecha de revisión, supuestos, unidades y alcance del ejemplo. Verifica cálculos manuales sencillos antes de presentar cifras. No conviertas ejemplos educativos en resultados atribuidos a proyectos. En novedades normativas, separa disposiciones aprobadas, propuestas, modificaciones transitorias y erratas; una fecha de consulta no es una nueva edición.

El corte documental de estas notas es el 8 de octubre de 2026. Las fuentes enlazadas permiten revisar su vigencia y aplicabilidad. La identidad profesional utiliza el título de Ingeniero Civil de la UNI; una traducción no añade una licencia PE ni una colegiatura no documentada. El CV público excluye dirección domiciliaria, documentos de identidad, teléfono personal y datos personales de terceros.

## Verificación

Estas comprobaciones no requieren paquetes de navegador:

```powershell
python scripts/build.py --check
node --check app.js
node --check hero-model.js
node --check navigation.js
node --check profile-data.js
node tests/smoke.test.cjs
node tests/links.test.cjs
node tests/content.test.cjs
```

La prueba de navegador añade revisión de escritorio/móvil, interacción del modelo, navegación, ausencia de JavaScript y accesibilidad con axe:

```powershell
node tests/browser.test.cjs
```

Requiere Playwright y axe-core. `PLAYWRIGHT_MODULE` selecciona el módulo, `BROWSER_PATH` permite usar Chrome/Edge instalado, `AXE_PATH` señala `axe.min.js` y `QA_SCREENSHOTS` define dónde guardar capturas e informe. Mantén dependencias e informes fuera del sitio. El workflow `.github/workflows/ci.yml` documenta las versiones y ejecuta las comprobaciones en GitHub Actions. Una prueba de accesibilidad automatizada complementa la revisión manual con teclado y lectura.

## Publicación y actualizaciones

Este repositorio corresponde a `SergioAmbrosio714/SergioAmbrosio714.github.io`. GitHub Pages publica desde `main`, carpeta `/(root)`; el workflow de CI valida el contenido. El perfil pertenece a otro repositorio: `SergioAmbrosio714/SergioAmbrosio714`.

Después de editar datos, regenerar páginas/PDF y superar las pruebas, revisa `git status` y `git diff`. Añade sólo los cambios revisados, crea un commit y realiza un push normal a `origin main`. Integra avances remotos antes de publicar; conserva el historial y las credenciales fuera de archivos o URLs.

Si trabajas con el paquete completo, `../PUBLICAR.md` y `../tools/publish_github.py` describen la comprobación y publicación coordinadas de ambos repositorios. Esas herramientas externas no forman parte del sitio. En un clon independiente, publica cada repositorio con Git y revisa las ejecuciones de Actions y Pages.

Comprueba después la portada ES/EN, fichas modificadas, descargas PDF y enlaces del perfil en sus URL públicas. Un push confirmado no demuestra por sí solo que la versión nueva ya se haya desplegado.
