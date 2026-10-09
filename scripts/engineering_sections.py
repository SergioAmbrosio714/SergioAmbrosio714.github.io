"""Static editorial sections for codes, engineering workflows and demonstrations."""
from html import escape
import posixpath
import json


def e(value):
    return escape(str(value), quote=True)


def t(lang, es, en):
    return es if lang == 'es' else en


def local(value, lang):
    return value[lang] if isinstance(value, dict) else value


def url(path, target):
    if target.startswith(('https:', '#')):
        return e(target)
    return e(posixpath.relpath(target, posixpath.dirname(path) or '.'))


def localized(lang, target):
    return ('en/' if lang == 'en' else '') + target


def figure_tools(path, lang, asset, download_label=None):
    target = url(path, asset)
    links = f'<a href="{target}" target="_blank" rel="noopener noreferrer">{t(lang,"Ver figura completa","Full-size figure")} <span aria-hidden="true">↗</span></a>'
    if download_label:
        links += f'<a href="{target}" download>{e(download_label)} <span aria-hidden="true">↓</span></a>'
    return f'<div class="figure-tools">{links}</div>'


def workflow(lang, automation):
    text = f'<div class="engineering-workflow"><div><span class="eyebrow">{t(lang,"DEL CRITERIO AL ENTREGABLE","FROM JUDGEMENT TO DELIVERABLE")}</span><h3>{t(lang,"Un proceso que se puede revisar.","A process that can be reviewed.")}</h3></div>'
    for kind in ('engineering', 'data'):
        text += f'<ol class="workflow-line workflow-{kind}" aria-label="{t(lang,"Proceso estructural" if kind == "engineering" else "Proceso de datos","Structural workflow" if kind == "engineering" else "Data workflow")}">' + ''.join(f'<li><span>{i:02d}</span>{e(label)}</li>' for i, label in enumerate(automation['workflow'][kind][lang], 1)) + '</ol>'
    return text + '</div>'


def standards_home(path, lang, standards, automation):
    target = url(path, localized(lang, 'normativa/index.html'))
    return f'''<section class="section codes-home" id="normativa"><div class="container"><div class="codes-intro"><div><span class="eyebrow">DESIGN CODES &amp; ENGINEERING STANDARDS</span><h2>{t(lang,'Diseñar. Verificar.<br><em>Sustentar.</em>','Design. Verify.<br><em>Substantiate.</em>')}</h2></div><div><h3>{t(lang,'Normativa y criterios de diseño','Design Codes &amp; Engineering Standards')}</h3><p>{t(lang,'Del criterio de cargas al detalle estructural: definir la norma aplicable, documentar hipótesis y revisar qué demuestra cada verificación. La edición consultada y la empleada en un proyecto se identifican por separado.','From loading criteria to structural details: establish the applicable code, document assumptions and examine what each check demonstrates. Reference editions and editions used on a particular project are identified separately.')}</p><a class="button button-primary" href="{target}">{t(lang,'Explorar criterios y normas','Explore codes and criteria')} ↗</a></div></div><div class="code-families"><a href="{target}#peru"><span>01 / PERÚ</span><h3>RNE</h3><p>E.020 · E.030 · E.050 · E.060</p><small>{t(lang,'Cargas, sismo, suelos y concreto. E.090: aplicación personal por confirmar.','Loads, seismic design, ground and concrete. E.090: personal application unconfirmed.')}</small></a><a href="{target}#international"><span>02 / {t(lang,'REFERENCIAS INTERNACIONALES','INTERNATIONAL FRAMEWORK')}</span><h3>ACI · ASCE · AISC</h3><p>{t(lang,'Concreto · Acero · Acciones · Evaluación','Concrete · Steel · Loads · Assessment')}</p><small>{t(lang,'Práctica profesional y referencias complementarias, con ediciones y actualizaciones.','Professional practice and supplementary references, with editions and update notes.')}</small></a><a href="{target}#casos-criterio"><span>03 / {t(lang,'CRITERIO APLICADO','APPLIED JUDGEMENT')}</span><h3>{t(lang,'Tres recorridos.','Three workflows.')}</h3><p>{t(lang,'Edificio · Estructura industrial · Reforzamiento','Building · Industrial frame · Retrofit')}</p><small>{t(lang,'Ejemplos conceptuales que conectan análisis, verificaciones y documentación.','Conceptual examples connecting analysis, checks and documentation.')}</small></a></div>{workflow(lang, automation)}</div></section>'''


def standards_page(path, lang, standards):
    data = standards[lang]
    home = url(path, localized(lang, 'index.html'))
    out = f'<main id="contenido"><header class="article-heading container"><a class="back-link" href="{home}#normativa">← {t(lang,"Volver al portafolio","Back to portfolio")}</a><span class="eyebrow">DESIGN CODES &amp; ENGINEERING STANDARDS</span><h1>{e(data["title"])}</h1><p class="article-deck">{e(data["intro"])}</p><p class="article-scope">{e(data["scope"])}</p><p class="review-date">{t(lang,"Fuentes revisadas","Sources reviewed")} · {e(standards["reviewed"])}</p><nav class="codes-jump" aria-label="{t(lang,"Familias normativas","Code families")}"><a href="#peru">RNE / Perú</a><a href="#international">ACI · ASCE · AISC</a><a href="#casos-criterio">{t(lang,"Casos de criterio","Engineering workflows")}</a><a href="{home}#referencias-normativas">E.030 2026 ↗</a></nav></header><div class="container codes-catalog">'
    status = {'declared': t(lang,'Práctica profesional · CV','Professional practice · CV'), 'reference': t(lang,'Referencia técnica complementaria','Supplementary technical reference'), 'pending': t(lang,'Aplicación personal por confirmar','Personal application unconfirmed')}
    for group in ('peru', 'international'):
        out += f'<section id="{group}" class="code-group"><div class="code-group-heading"><span class="eyebrow">{t(lang,"NORMATIVA NACIONAL" if group == "peru" else "NORMATIVA INTERNACIONAL","NATIONAL CODES" if group == "peru" else "INTERNATIONAL STANDARDS")}</span><h2>{t(lang,"Reglamento Nacional de Edificaciones" if group == "peru" else "Concreto, acero, acciones y evaluación","Peruvian National Building Regulations" if group == "peru" else "Concrete, steel, loads and assessment")}</h2></div>'
        for item in [x for x in standards['items'] if x['group'] == group]:
            d = item[lang]
            out += f'<details class="code-entry" id="{e(item["id"])}"><summary><span class="code-designation">{e(item["designation"])}</span><span><strong>{e(d["name"])}</strong><small>{e(d["family"])} · {e(status[item["practice"]])}</small></span><span class="code-expand" aria-hidden="true">+</span></summary><div class="code-entry-body"><div class="code-record"><dl>'
            for label, value in [(t(lang,'Emisor','Issuer'),local(item['issuer'],lang)),(t(lang,'Ámbito','Region'),d['region']),(t(lang,'Edición de referencia','Reference edition'),local(item['referenceEdition'],lang)),(t(lang,'Consulta','Reviewed'),item['reviewed'])]:
                out += f'<div><dt>{label}</dt><dd>{e(value)}</dd></div>'
            out += f'</dl><p>{e(d["editionStatus"])}</p><p>{e(d["practiceStatus"])}</p><div class="code-sources">'
            for ref in item['references']:
                out += f'<a href="{e(ref["url"])}" target="_blank" rel="noopener noreferrer">{e(local(ref["title"],lang))} ↗</a>'
            out += '</div></div><div class="code-applications">'
            for label, values in [(t(lang,'Aplicaciones habituales','Typical applications'),d['applications']),(t(lang,'Qué se verifica','What is checked'),d['checks'])]:
                out += f'<h3>{label}</h3><ul>' + ''.join(f'<li>{e(value)}</li>' for value in values) + '</ul>'
            out += f'<h3>{t(lang,"Relación con el portafolio","Portfolio relevance")}</h3><p>{e(d["projectRelation"])}</p><p class="code-scope">{e(d["scope"])}</p></div></div></details>'
        out += '</section>'
    out += f'<section id="casos-criterio" class="code-case-section"><span class="eyebrow">{t(lang,"CRITERIO APLICADO / EJEMPLOS CONCEPTUALES","APPLIED JUDGEMENT / CONCEPTUAL EXAMPLES")}</span><h2>{t(lang,"De la norma al razonamiento de diseño.","From the code to engineering reasoning.")}</h2>'
    for i,item in enumerate(standards['cases']):
        d=item[lang]
        out += f'<article class="code-case" id="caso-{e(item["id"])}"><header><span>{chr(65+i)}</span><div><h3>{e(d["title"])}</h3><p>{e(d["summary"])}</p><small>{e(d["status"])}</small></div></header><ol>'
        for step in d['steps']:
            out += f'<li><h4>{e(step["title"])}</h4><p>{e(step["description"])}</p><div class="step-codes">' + ''.join(f'<a href="#{e(code)}">{e(next(x["designation"] for x in standards["items"] if x["id"] == code))}</a>' for code in step.get('codes',[])) + '</div></li>'
        out += f'</ol><div class="case-deliverable"><strong>{t(lang,"Entregable revisable","Reviewable deliverable")}</strong><p>{e(d["deliverable"])}</p></div><p class="case-scope">{e(d["scope"])}</p></article>'
    return out + '</section></div></main>'


def automation_home(path,lang,data):
    out=f'<section class="section automation-home" id="programacion"><div class="container"><div class="section-heading"><div><span class="eyebrow">PYTHON / ENGINEERING AUTOMATION</span><h2>{t(lang,"Del dato<br>al criterio.","From data<br>to judgement.")}</h2></div><p>{e(data["intro"][lang])}</p></div><h3 class="automation-subtitle">{e(data["title"][lang])}</h3><div class="automation-demos">'
    for i,demo in enumerate(data['demos'],1):
        d=demo[lang]; link=url(path,localized(lang,'laboratorio/'+demo['slug']+'.html'))
        asset = 'assets/demo-'+demo['id']+'-plot-'+lang+'.svg'
        out+=f'<article class="automation-demo"><div class="demo-sequence">0{i} / {t(lang,"DEMOSTRADOR FUNCIONAL","WORKING DEMONSTRATION")}</div><a class="demo-preview demo-preview-{demo["id"]}" href="{link}"><img src="{url(path,asset)}" alt="{t(lang,"Gráfico exportado por el demostrador con los datos sintéticos de ejemplo.","Plot exported by the demonstration using the synthetic sample data.")}" width="780" height="550" loading="lazy"><span class="demo-preview-caption">{t(lang,"EJEMPLO SINTÉTICO / SALIDA REAL DEL DEMOSTRADOR","SYNTHETIC EXAMPLE / ACTUAL DEMONSTRATION OUTPUT")}</span></a>'
        out+=figure_tools(path,lang,asset)
        out+=f'<h3><a href="{link}">{e(d["title"])}</a></h3><p>{e(d["description"])}</p><div class="demo-card-actions"><a class="text-link" href="{link}">{t(lang,"Abrir demostrador","Open demonstration")} ↗</a><a href="{url(path,demo["source"])}" download>{t(lang,"Código Python","Python source")} ↓</a></div></article>'
    out+=f'</div><p class="automation-provenance">{e(data["scope"][lang])}</p><details class="automation-applications"><summary>{t(lang,"Diez aplicaciones: problema, procedimiento y salida","Ten applications: problem, procedure and output")}</summary><div>'
    for i,item in enumerate(data['applications'],1):
        d=item[lang];out+=f'<article><span>{i:02d}</span><h3>{e(d["title"])}</h3><p>{e(d["problem"])}</p><p>{e(d["method"])}</p><p class="application-output">{e(d["output"])}</p></article>'
    out+=f'</div></details><div class="automation-source-links"><a href="https://github.com/SergioAmbrosio714/SergioAmbrosio714.github.io/tree/main/python" target="_blank" rel="noopener noreferrer">{t(lang,"Explorar código, ejemplos y pruebas","Explore source, examples and tests")} ↗</a><a href="{url(path,"python/README.md" if lang=="es" else "python/README.md#english")}">{t(lang,"Instrucciones de ejecución","Run instructions")} ↗</a><a href="{url(path,localized(lang,"casos/03-autolisp.html"))}">AutoLISP &amp; CAD ↗</a></div></div></section>'
    return out


def demo_page(path,lang,demo,sample):
    d=demo[lang];kind=demo['id'];s=t
    out=f'<main id="contenido"><header class="article-heading container demo-heading"><a class="back-link" href="{url(path,localized(lang,"index.html"))}#programacion">← {s(lang,"Programación y automatización","Python & Engineering Automation")}</a><span class="eyebrow">STRUCTURAL LAB / PYTHON / {s(lang,"DEMOSTRACIÓN NUEVA · OCTUBRE 2026","NEW DEMONSTRATION · OCTOBER 2026")}</span><h1>{e(d["title"])}</h1><p class="article-deck">{e(d["subtitle"])}</p><p class="demo-introduction">{e(d["description"])}</p><div class="demo-top-links"><a href="{url(path,demo["source"])}" download>{s(lang,"Descargar módulo Python","Download Python module")} ↓</a><a href="{url(path,demo["example"])}" download>{s(lang,"CSV de ejemplo","Example CSV")} ↓</a><a href="https://github.com/SergioAmbrosio714/SergioAmbrosio714.github.io/tree/main/python" target="_blank" rel="noopener noreferrer">{s(lang,"Código y pruebas","Source and tests")} ↗</a></div></header><div class="container demo-container"><noscript><p class="demo-notice">{s(lang,"Activa JavaScript para usar los controles. El código Python y los ejemplos descargables funcionan por separado con Python 3.10 o posterior.","Enable JavaScript to use the controls. The downloadable Python source and examples run independently with Python 3.10 or later.")}</p></noscript><section class="demo-workbench" data-demo="{kind}" aria-label="{s(lang,"Herramienta de demostración","Demonstration tool")}"><div class="demo-controls"><span class="eyebrow">01 / {s(lang,"ENTRADAS","INPUTS")}</span>'
    if kind=='storeys':
        out+=f'<h2>{s(lang,"Revisión por niveles","Storey review")}</h2><p>{s(lang,"Formato explícito, unidades compatibles y casos comparables.","An explicit format, compatible units and comparable cases.")}</p><label class="file-label" for="results-file">{s(lang,"Importar archivo CSV","Import CSV file")}</label><input id="results-file" type="file" accept=".csv,text/csv" aria-describedby="file-help"><p id="file-help" class="input-help">{s(lang,"Máximo 2 MiB y 5.000 filas. Se procesa en tu navegador; no se envía a un servidor.","Up to 2 MiB and 5,000 rows. Processing stays in your browser; the file is not sent to a server.")}</p><button type="button" class="demo-button" id="demo-load-example">{s(lang,"Cargar datos de demostración","Load demonstration data")}</button><label for="reference-case">{s(lang,"Caso de referencia","Reference case")}</label><select id="reference-case"></select><p class="input-help">{s(lang,"La comparación utiliza niveles y elevaciones coincidentes. No aplica límites normativos de deriva.","Comparison requires matching levels and elevations. No code drift limits are applied.")}</p>'
    else:
        out+=f'<h2>{s(lang,"Voladizo rectangular","Rectangular cantilever")}</h2><p>{s(lang,"Carga puntual descendente en el extremo libre. Sección constante y comportamiento elástico lineal.","Downward point load at the free end. Constant cross-section and linear elastic response.")}</p><form id="cantilever-form" novalidate>'
        inputs=[('length','L / '+s(lang,'Longitud','Length'),'m',2,0.01,100,.1),('width','b / '+s(lang,'Ancho','Width'),'mm',100,1,5000,10),('depth','h / '+s(lang,'Peralte','Depth'),'mm',200,1,5000,10),('elastic','E / '+s(lang,'Módulo elástico','Elastic modulus'),'GPa',200,.001,1000,1),('load','P / '+s(lang,'Carga puntual','Point load'),'kN',10,0,100000,1),('stress',s(lang,'Tensión de referencia','Reference stress'),'MPa',250,.001,100000,10)]
        for id,label,unit,value,minval,maxval,step in inputs:
            out+=f'<div class="parameter"><label for="param-{id}">{label} <span>{unit}</span></label><input type="number" id="param-{id}" name="{id}" value="{value}" min="{minval}" max="{maxval}" step="any" inputmode="decimal" required></div>'
        out+=f'<p class="input-help">{s(lang,"La tensión de referencia sólo normaliza la comparación; no es una resistencia de diseño ni un límite aprobado.","Reference stress only normalizes the comparison; it is not a design resistance or an approved limit.")}</p><button type="submit" class="demo-button">{s(lang,"Calcular y comparar","Calculate and compare")} ↗</button><button type="button" id="demo-reset" class="demo-reset">{s(lang,"Restablecer ejemplo","Reset example")}</button></form>'
    out+=f'</div><div class="demo-results"><div class="demo-result-heading"><span class="eyebrow">02 / {s(lang,"RESULTADOS TRAZABLES","TRACEABLE RESULTS")}</span><span id="dataset-label">{s(lang,"DATOS DE DEMOSTRACIÓN","DEMONSTRATION DATA")}</span></div><p id="demo-error" class="demo-error" role="alert" hidden></p><p id="demo-status" class="demo-status" role="status" aria-live="polite"></p><div id="demo-output"><div id="demo-metrics" class="demo-metrics"></div><div id="demo-chart" class="demo-chart"></div><p id="chart-note" class="input-help"></p><div class="demo-exports"><button type="button" id="export-csv">CSV ↓</button><button type="button" id="export-json">JSON ↓</button><button type="button" id="export-svg">{s(lang,"Gráfico SVG","SVG plot")} ↓</button></div><div id="demo-table" class="demo-table"></div></div></div></section>'
    out+=f'<section class="demo-documentation"><div><span class="eyebrow">03 / {s(lang,"MÉTODO Y REPRODUCIBILIDAD","METHOD AND REPRODUCIBILITY")}</span><h2>{s(lang,"Qué se calcula.<br>Cómo se comprueba.","What is calculated.<br>How it is checked.")}</h2><p>{s(lang,"La interfaz ejecuta una implementación JavaScript ligera. Los módulos Python descargables procesan los mismos ejemplos; pruebas de paridad comparan ambas salidas. No hay conexión activa con ETABS o SAP2000.","The interface runs a lightweight JavaScript implementation. The downloadable Python modules process the same examples; parity tests compare both outputs. There is no active connection to ETABS or SAP2000.")}</p></div><div>'
    out+=f'<p>{s(lang,"Para ejecutar el módulo, conserva _common.py en el mismo directorio y descarga también el CSV de ejemplo. El repositorio incluye ambos módulos, ejemplos y pruebas.","To run a module, keep _common.py in the same directory and download the example CSV. The repository includes both modules, examples and tests.")} <a href="{url(path,"python/_common.py")}" download>_common.py ↓</a></p>'
    if kind=='storeys':
        out+=f'<h3>{s(lang,"Formato de intercambio","Exchange format")}</h3><pre tabindex="0"><code>case,level,elevation,displacement,elevation_unit,displacement_unit</code></pre><p>{s(lang,"Unidades de longitud aceptadas: m, cm y mm. Cada par caso–nivel debe ser único. Todos los casos deben compartir niveles y elevaciones. El primer nivel conserva desplazamiento absoluto; su deriva entre niveles se deja sin valor porque no se presupone un apoyo inferior.","Accepted length units: m, cm and mm. Every case–level pair must be unique. All cases must share levels and elevations. The first level retains absolute displacement; its interstorey drift is left undefined because no lower support is assumed.")}</p><div class="equation">Δuᵢ = uᵢ − uᵢ₋₁<br>hᵢ = zᵢ − zᵢ₋₁<br>driftᵢ = Δuᵢ / hᵢ</div><p>{s(lang,"La deriva geométrica exportada no incluye amplificaciones reglamentarias ni una comprobación de cumplimiento. Revisa el tipo de desplazamiento exportado, su referencia y el significado de cada caso antes de usar resultados reales.","Exported geometric drift includes no code amplification or compliance check. Review the exported displacement type, its datum and the meaning of each case before using actual results.")}</p>'
    else:
        out+=f'<h3>Euler–Bernoulli</h3><div class="equation">I = bh³ / 12<br>v(x) = Px²(3L − x) / (6EI)<br>θ(x) = Px(2L − x) / (2EI)<br>v(L) = PL³ / (3EI)<br>σ(x) = M(x)h / (2I)</div><p>{s(lang,"x se mide desde el empotramiento. La carga y el desplazamiento se toman positivos hacia abajo; V=P y M=P(L−x) siguen la convención interna declarada. Las reacciones son −P y −PL. El gráfico de deformación está amplificado y no representa la geometría deformada a escala.","x is measured from the fixed end. Load and displacement are positive downwards; V=P and M=P(L−x) follow the declared internal-force convention. Reactions are −P and −PL. The deflection plot is amplified and does not show the deformed geometry to scale.")}</p><p>{s(lang,"El ejemplo inicial produce 2,00 mm de desplazamiento, 0,0015 rad de giro y 30 MPa de tensión extrema. Al duplicar el peralte, la inercia aumenta ocho veces y la flecha disminuye a un octavo. No se incluyen peso propio, deformación por cortante, plasticidad, pandeo, conexiones ni verificaciones normativas.","The initial example gives 2.00 mm displacement, 0.0015 rad rotation and 30 MPa extreme-fibre stress. Doubling depth increases second moment of area eightfold and reduces deflection to one eighth. Self-weight, shear deformation, plasticity, buckling, connections and code checks are excluded.")}</p>'
    out+=f'<h3>{s(lang,"Ejecutar Python y revisar pruebas","Run Python and inspect tests")}</h3><pre tabindex="0"><code>cd python\npython {"process_results.py examples/storey-results.csv --json results.json --csv results.csv" if kind=="storeys" else "cantilever.py examples/cantilever-scenarios.csv --json results.json --csv results.csv"}\npython -m unittest discover -s tests -v</code></pre><p><a href="{url(path,"python/README.md" if lang=="es" else "python/README.md#english")}">{s(lang,"Documentación, validaciones y limitaciones","Documentation, validation and limitations")} ↗</a></p><p class="demo-origin">{s(lang,"Ejemplo didáctico de 2026, independiente de trabajos para empleadores y sin validación de diseño normativo.","2026 educational example, developed independently of employer projects and not validated for code-compliant design.")}</p></div></section></div></main>'
    capture='assets/demo-'+kind+'-'+lang+'.png'
    capture_tools=figure_tools(path,lang,capture,s(lang,"Descargar captura PNG","Download PNG screenshot"))
    proof=f'<details class="demo-capture"><summary>{s(lang,"Ver captura de la interfaz con el ejemplo inicial","View interface capture with the initial example")}</summary><figure><img src="{url(path,capture)}" alt="{s(lang,"Captura real del demostrador ejecutándose con datos sintéticos, controles, gráfico y tabla de resultados.","Actual screenshot of the running demonstration with synthetic data, controls, plot and results table.")}" width="1328" height="{1320 if kind=="storeys" else 1150}" loading="lazy"><figcaption>{s(lang,"Captura directa de esta interfaz en navegador, octubre de 2026. Datos sintéticos del CSV de ejemplo; no corresponde a ETABS, SAP2000 ni a un proyecto profesional.","Direct browser capture of this interface, October 2026. Synthetic data from the example CSV; it is not an ETABS/SAP2000 capture or a professional project.")}</figcaption>{capture_tools}</figure></details>'
    out=out.replace('</section></div></main>','</section>'+proof+'</div></main>')
    config={'kind':kind,'sampleCSV':sample,'language':lang}
    out+='<script id="demo-config" type="application/json">'+json.dumps(config,ensure_ascii=False).replace('<','\\u003c')+'</script>'
    return out
