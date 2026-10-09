"""Build the bilingual static portfolio from data/. No third-party dependencies.

Run with --check to verify that committed outputs match their sources.
Professional identity, projects and publications also generate the public CV
and, when the sibling repository exists, the GitHub profile README.
"""
from pathlib import Path
from html import escape
import argparse
import json
import posixpath
import re
from engineering_sections import standards_home, standards_page, automation_home, demo_page

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://sergioambrosio714.github.io/'
OUTPUT = {}


def read(name):
    return json.loads((ROOT / 'data' / (name + '.json')).read_text(encoding='utf-8'))


def e(value):
    return escape(str(value), quote=True)


def tr(lang, es, en):
    return es if lang == 'es' else en


def loc(value, lang):
    return value.get(lang, '') if isinstance(value, dict) else value


def href(path, target):
    if target.startswith(('https:', 'http:', 'mailto:', '#')):
        return e(target)
    return e(posixpath.relpath(target, posixpath.dirname(path) or '.'))


def route(lang, group='', slug=''):
    prefix = '' if lang == 'es' else 'en/'
    return prefix + (f'{group}/{slug}.html' if group else 'index.html')


def emit(path, content):
    OUTPUT[path] = content.rstrip() + '\n'


def ext(url, title):
    return f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(title)} <span aria-hidden="true">↗</span></a>'


def head(path, lang, title, description, counterpart, kind='website', home=False):
    canonical = BASE + ('' if path == 'index.html' else path)
    alt_es = path if lang == 'es' else counterpart
    alt_en = path if lang == 'en' else counterpart
    scripts = (f'<script src="{href(path, "profile-data.js")}" defer></script><script src="{href(path, "app.js")}" defer></script><script src="{href(path, "hero-model.js")}" defer></script>' if home else f'<script src="{href(path, "navigation.js")}" defer></script>')
    return f'''<!doctype html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — Sergio Ambrosio</title>
<meta name="description" content="{e(description)}"><meta name="theme-color" content="#183d49">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="es" href="{BASE + alt_es}"><link rel="alternate" hreflang="en" href="{BASE + alt_en}"><link rel="alternate" hreflang="x-default" href="{BASE + alt_es}">
<meta property="og:type" content="{kind}"><meta property="og:locale" content="{tr(lang, 'es_PE', 'en_US')}">
<meta property="og:title" content="{e(title)} — Sergio Ambrosio"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}assets/og-cover.png"><meta property="og:image:alt" content="Sergio Ambrosio — Structural Engineering"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{href(path, 'assets/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="{href(path, 'styles.css')}"><link rel="stylesheet" href="{href(path, 'editorial.css')}"><link rel="stylesheet" href="{href(path, 'engineering.css')}">
{scripts}
<noscript><style>.nav-toggle,.control,.lab-reset,.filter-bar{{display:none!important}}@media(max-width:1100px){{.primary-nav{{display:flex;position:static;flex-wrap:wrap;flex-direction:row;grid-column:1/-1;width:100%;padding:12px 0;gap:12px}}.primary-nav a{{padding:4px 0}}.nav-row{{flex-wrap:wrap}}}}</style></noscript>
</head><body class="editorial">
<a class="skip-link" href="#contenido">{tr(lang, 'Ir al contenido', 'Skip to content')}</a>'''


def header(path, lang, counterpart):
    home = route(lang)
    labels = [('inicio', 'Inicio', 'Home'), ('experiencia', 'Experiencia', 'Experience'), ('proyectos', 'Proyectos', 'Projects'), ('investigacion', 'Investigación', 'Research'), ('normativa', 'Normativa', 'Design codes'), ('especialidades', 'Especialidades', 'Expertise'), ('programacion', 'Python', 'Python'), ('notas', 'Notas técnicas', 'Insights'), ('perfil', 'Sobre mí', 'About'), ('contacto', 'Contacto', 'Contact')]
    nav = ''.join(f'<a href="{href(path, home)}#{key}">{tr(lang, es, en)}</a>' for key, es, en in labels)
    return f'''<header class="site-header" id="header"><div class="container identity-row">
<a class="brand" href="{href(path, home)}" aria-label="Sergio Ambrosio, {tr(lang, 'inicio', 'home')}"><img src="{href(path, 'assets/logo.svg')}" width="37" height="37" alt=""><span><strong>SERGIO AMBROSIO</strong><small>STRUCTURAL ENGINEERING</small></span></a>
<div class="header-actions"><a class="cv-link" href="{href(path, f'assets/cv-sergio-ambrosio-{lang}.pdf')}" download>{tr(lang, 'Descargar CV', 'Download CV')} <span aria-hidden="true">↓</span></a>{ext(PROFILE['linkedin'], 'LinkedIn')}<a class="language-link" href="{href(path, counterpart)}" lang="{tr(lang, 'en', 'es')}" hreflang="{tr(lang, 'en', 'es')}" aria-label="{tr(lang, 'Read in English', 'Leer en español')}">{tr(lang, 'EN', 'ES')}</a></div></div>
<div class="container nav-row"><span class="nav-caption">{tr(lang, 'LIMA, PERÚ · ALCANCE INTERNACIONAL', 'LIMA, PERU · INTERNATIONAL OUTLOOK')}</span><nav class="primary-nav" id="primary-nav" aria-label="{tr(lang, 'Navegación principal', 'Main navigation')}">{nav}</nav><button type="button" class="nav-toggle" id="nav-toggle" aria-controls="primary-nav" aria-expanded="false" aria-label="{tr(lang, 'Abrir menú', 'Open menu')}"><span></span><span></span></button></div></header>'''


def footer(path, lang):
    return f'''<footer class="site-footer"><div class="container footer-row"><span>© <span id="year">2026</span> SERGIO AMBROSIO</span><span>STRUCTURAL ENGINEERING</span><a href="{href(path, route(lang))}#inicio">{tr(lang, 'Volver al inicio', 'Back to home')} ↑</a></div></footer></body></html>'''


def image_figure(item, path, lang, metadata=True, eager=False):
    image = item.get('image')
    if not image:
        return ''
    data = item[lang]
    alt = data.get('imageAlt', loc(image.get('description', image.get('caption', '')), lang))
    caption = loc(image.get('caption', ''), lang)
    details = ''
    if metadata:
        fields = [('source', 'Fuente', 'Source'), ('software', 'Herramienta', 'Tool'), ('date', 'Fecha', 'Date'), ('description', 'Descripción', 'Description'), ('usage', 'Condición de uso', 'Usage')]
        pairs = ''.join(f'<div><dt>{tr(lang, es, en)}</dt><dd>{e(loc(image[key], lang))}</dd></div>' for key, es, en in fields if image.get(key))
        details = f'<details class="image-provenance"><summary>{tr(lang, "Procedencia de la figura", "Figure provenance")}</summary><dl>{pairs}</dl></details>'
    return f'<figure class="technical-figure"><img src="{href(path, image["src"])}" alt="{e(alt)}" width="{image.get("width", 1200)}" height="{image.get("height", 760)}" loading="{("eager" if eager else "lazy")}" decoding="async"><figcaption>{e(caption)}</figcaption>{details}</figure>'


def facts(data):
    return '<dl class="article-facts">' + ''.join(f'<div><dt>{e(x["label"])}</dt><dd>{e(x["value"])}</dd></div>' for x in data.get('facts', [])) + '</dl>'


def references(item, lang):
    refs = item.get('references', [])
    if not refs:
        return ''
    rows = ''.join('<li>' + (ext(r['url'], loc(r['title'], lang)) if r.get('url') else e(loc(r['title'], lang))) + (f'<p>{e(loc(r["note"], lang))}</p>' if r.get('note') else '') + '</li>' for r in refs)
    return f'<section id="referencias" class="reference-section"><h2>{tr(lang, "Fuentes y referencias", "Sources and references")}</h2><ol>{rows}</ol></section>'


def sections(data, path, lang):
    result = []
    for index, sec in enumerate(data.get('sections', []), 1):
        content = ''.join(f'<p>{e(p)}</p>' for p in sec.get('paragraphs', []))
        if sec.get('equation'):
            content += f'<div class="equation">{e(sec["equation"])}</div>'
        if sec.get('code'):
            content += f'<pre class="article-code" tabindex="0"><code>{e(sec["code"]["text"])}</code></pre>'
        if sec.get('links'):
            content += '<div class="section-links">' + ''.join(f'<a href="{href(path, loc(link["href"], lang))}">{e(loc(link["label"], lang))} ↗</a>' for link in sec['links']) + '</div>'
        if sec.get('bullets'):
            content += '<ul>' + ''.join(f'<li>{e(p)}</li>' for p in sec['bullets']) + '</ul>'
        if sec.get('table'):
            table = sec['table']
            content += '<div class="table-scroll"><table><thead><tr>' + ''.join(f'<th scope="col">{e(v)}</th>' for v in table['headers']) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{e(v)}</td>' for v in row) + '</tr>' for row in table['rows']) + '</tbody></table></div>'
        result.append(f'<section id="seccion-{index}"><h2>{e(sec["title"])}</h2>{content}</section>')
    return ''.join(result)


def article(item, group, lang):
    path = route(lang, group, item['slug'])
    counterpart = route(tr(lang, 'en', 'es'), group, item['slug'])
    data = item[lang]
    section_key = {'proyectos': 'proyectos', 'investigacion': 'investigacion', 'notas': 'notas'}[group]
    label = {'proyectos': tr(lang, 'Experiencia profesional', 'Professional experience'), 'investigacion': tr(lang, 'Investigación y publicaciones', 'Research & publications'), 'notas': tr(lang, 'Notas técnicas', 'Engineering insights')}[group]
    toc = ''.join(f'<a href="#seccion-{i}">{i:02d} / {e(s["title"])}</a>' for i, s in enumerate(data.get('sections', []), 1))
    authors = f'<p class="official-title" lang="{("es" if item.get("referenceTitle", "").startswith("DESEMPEÑO") else "en")}">{e(item["referenceTitle"])}</p><p class="article-authors">{e(" · ".join(item["authors"]))}</p>' if item.get('authors') else ''
    date = item.get('date', PROFILE['lastReviewed'])
    scope = f'<p class="article-scope">{e(data.get("scope", ""))}</p>' if data.get('scope') else ''
    description = re.split(r'(?<=[.!?])\s+', data['summary'])[0]
    body = head(path, lang, data['title'], description, counterpart, 'article') + header(path, lang, counterpart)
    body += f'''<main id="contenido"><header class="article-heading container"><a class="back-link" href="{href(path, route(lang))}#{section_key}">← {label}</a><span class="eyebrow">{e(data.get('category', label))} / {e(item.get('year', date[:4]))}</span><h1>{e(data['title'])}</h1><p class="article-deck">{e(data.get('subtitle', data['summary']))}</p>{authors}<div class="article-status">{e(data.get('status', tr(lang, 'Nota de divulgación técnica', 'Technical explainer')))}<span>{tr(lang, 'Revisado', 'Reviewed')} {e(date)}</span></div>{scope}{facts(data)}</header>
<div class="container article-layout"><aside class="article-aside"><nav aria-label="{tr(lang, 'Índice del artículo', 'Article contents')}"><span class="eyebrow">{tr(lang, 'En esta página', 'On this page')}</span>{toc}<a href="#referencias">{tr(lang, 'Fuentes', 'References')} ↗</a></nav><a class="aside-cv" href="{href(path, f'assets/cv-sergio-ambrosio-{lang}.pdf')}">{tr(lang, 'Descargar CV', 'Download CV')} ↓</a></aside><article class="article-body"><p class="article-intro">{e(data['summary'])}</p>{image_figure(item, path, lang, eager=True)}{sections(data, path, lang)}{references(item, lang)}<nav class="article-bottom" aria-label="{tr(lang, 'Continuar explorando', 'Continue exploring')}"><a href="{href(path, route(lang))}#{section_key}">← {label}</a><a href="{href(path, counterpart)}" hreflang="{tr(lang, 'en', 'es')}">{tr(lang, 'Read in English', 'Leer en español')} →</a></nav></article></div></main>'''
    if group == 'investigacion':
        schema = {'@context': 'https://schema.org', '@type': 'ScholarlyArticle', 'headline': item.get('referenceTitle', data['title']), 'author': [{'@type': 'Person', 'name': a} for a in item['authors']], 'datePublished': str(item['year']), 'inLanguage': lang, 'url': BASE + path, 'citation': [r['url'] for r in item.get('references', []) if r.get('url')]}
        body += '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c') + '</script>'
    emit(path, body + footer(path, lang))


def heading(number, title, text, lang):
    return f'<div class="section-heading"><div><span class="eyebrow">{number} / {tr(lang, "PORTAFOLIO PROFESIONAL", "PROFESSIONAL PORTFOLIO")}</span><h2>{title}</h2></div><p>{text}</p></div>'


def home(lang):
    path = route(lang)
    counterpart = route(tr(lang, 'en', 'es'))
    description = tr(lang, 'Ingeniero Civil titulado por la UNI. Diseño de acero y concreto para minería, edificaciones e infraestructura; análisis sísmico y no lineal.', 'Civil engineer with a professional degree from UNI. Steel and concrete design for mining, buildings and infrastructure; seismic and nonlinear analysis.')
    body = head(path, lang, tr(lang, 'Ingeniería estructural · Acero, concreto y minería', 'Structural Engineer · Steel, Concrete & Mining'), description, counterpart, home=True) + header(path, lang, counterpart)
    body += f'''<main id="contenido"><section class="hero" id="inicio" aria-labelledby="hero-title"><div class="container hero-layout"><div class="hero-copy"><span class="eyebrow">{tr(lang, 'INGENIERO CIVIL TITULADO · UNI', 'CIVIL ENGINEER · UNI PROFESSIONAL DEGREE')}</span><h1 id="hero-title">Structural<br><em>Engineering.</em></h1><p class="hero-lead">{tr(lang, 'Diseño estructural en acero y concreto.<br><strong>Minería, edificaciones e infraestructura.</strong>', 'Steel and concrete structural design.<br><strong>Mining, buildings and infrastructure.</strong>')}</p><p class="hero-analysis">{tr(lang, 'Acero · Concreto · Minería · Análisis avanzado', 'Steel · Concrete · Mining · Advanced analysis')}</p><p class="hero-code-line">{tr(lang, "Diseño normativo · Python · Automatización estructural", "Design codes · Python · Structural automation")}</p><div class="hero-actions"><a class="button button-primary" href="#proyectos">{tr(lang, 'Explorar proyectos', 'Explore projects')} <span aria-hidden="true">↗</span></a><a class="hero-research-link" href="#investigacion">{tr(lang, 'Investigación y publicaciones', 'Research & publications')} <span aria-hidden="true">↓</span></a></div><div class="hero-current"><span class="current-dot" aria-hidden="true"></span><div><strong>{tr(lang, 'Actualmente en SRK', 'Currently at SRK')}</strong><span>{tr(lang, 'Ingeniería estructural para minería', 'Structural engineering for mining')}</span></div></div></div>
<figure class="hero-art" aria-labelledby="hero-model-caption"><div class="model-topline"><span>01 / {tr(lang, 'GEOMETRÍA ESTRUCTURAL', 'STRUCTURAL GEOMETRY')}</span><span>{tr(lang, 'ACERO + CONCRETO', 'STEEL + CONCRETE')}</span></div><div class="hero-model"><img class="hero-drawing" src="{href(path, 'assets/hero-structure.svg')}" width="900" height="760" fetchpriority="high" alt="{tr(lang, 'Modelo conceptual de estructura industrial con perfiles de acero, plataformas, arriostres y cimentaciones de concreto.', 'Conceptual industrial frame with steel members, platforms, bracing and concrete foundations.')}"><canvas id="structural-model" width="900" height="760" role="img" aria-label="{tr(lang, 'Modelo industrial conceptual tridimensional. Utiliza los controles de vista.', 'Conceptual three-dimensional industrial model. Use the view controls.')}" aria-describedby="hero-model-caption"></canvas></div><div class="model-toolbar" role="group" aria-label="{tr(lang, 'Orientación del modelo', 'Model orientation')}"><span class="model-hint">{tr(lang, 'Arrastra para girar', 'Drag to rotate')}</span><button type="button" data-model-view="iso" aria-pressed="true">3D</button><button type="button" data-model-view="front" aria-pressed="false">{tr(lang, 'Frontal', 'Front')}</button><button type="button" data-model-view="side" aria-pressed="false">{tr(lang, 'Lateral', 'Side')}</button><button type="button" id="model-reset" aria-label="{tr(lang, 'Restablecer vista del modelo', 'Reset model view')}">↺</button><button type="button" id="model-static-toggle" aria-pressed="false">{tr(lang, 'Estática', 'Static')}</button></div><figcaption id="hero-model-caption">{tr(lang, 'Modelo conceptual de geometría. Acero y concreto; sin resultados de cálculo.', 'Conceptual geometric model. Steel and concrete; no analysis results.')}</figcaption></figure></div></section>
<div class="credential-strip"><div class="container credential-row"><div><strong>{PROFILE['yearsExperience']} <small>{tr(lang, 'años', 'years')}</small></strong><span>{tr(lang, 'Diseño y revisión estructural', 'Structural design and review')}</span></div><div><strong>21 + 3</strong><span>{tr(lang, 'Niveles y sótanos · SUNSETGOLF C', 'Storeys and basements · SUNSETGOLF C')}</span></div><a href="{href(path, route(lang, 'investigacion', RESEARCH['items'][0]['slug']))}"><strong>17WCEE</strong><span>{tr(lang, 'Coautor y expositor · Congreso mundial', 'Co-author and presenter · World conference')} ↗</span></a></div></div>
<section class="section work-section" id="proyectos"><div class="container">{heading('01', tr(lang, 'Del modelo<br>al proyecto.', 'From the model<br>to the project.'), tr(lang, 'Edificaciones de concreto, infraestructura eléctrica y estructuras metálicas. Una selección de mi experiencia en diseño y revisión.', 'Concrete buildings, electrical infrastructure and steel structures. Selected experience in structural design and review.'), lang)}<div class="selected-projects">'''
    for i, item in enumerate(PROJECTS['items']):
        data = item[lang]
        link = href(path, route(lang, 'proyectos', item['slug']))
        body += f'<article class="selected-project selected-project-{i+1}"><a class="project-visual" href="{link}" aria-label="{e(data["title"])}"><img src="{href(path, item["image"]["src"])}" width="1200" height="760" loading="lazy" alt="{e(data.get("imageAlt", ""))}"><span class="visual-label">{tr(lang, "ILUSTRACIÓN ESTRUCTURAL", "STRUCTURAL ILLUSTRATION")}</span><span class="visual-arrow" aria-hidden="true">↗</span></a><div class="selected-project-copy"><span class="eyebrow">0{i+1} / {e(data.get("category", ""))} · {item.get("year", "")}</span><h3><a href="{link}">{e(data["title"])}</a></h3><p>{e(data["summary"])}</p><a class="text-link" href="{link}">{tr(lang, "Ver alcance y desarrollo", "Explore scope and approach")} ↗</a></div></article>'
    body += '</div></div></section>'
    body += standards_home(path, lang, STANDARDS, AUTOMATION)
    primary = RESEARCH['items'][0]
    rp = primary[lang]
    body += f'''<section class="section research-section" id="investigacion"><div class="container"><div class="research-feature"><div class="research-editorial"><span class="eyebrow">02 / RESEARCH &amp; PUBLICATIONS</span><p class="conference-mark">17<span>WCEE</span><small>SENDAI · 2021</small></p><h2>{tr(lang, 'Entender la respuesta.<br>Ampliar el criterio.', 'Understand the response.<br>Inform the design.')}</h2><p>{tr(lang, 'Investigación sobre aislamiento sísmico de tanques: la interacción entre estructura, líquido y sistema de protección.', 'Research into seismic isolation of storage tanks: the interaction between the structure, the liquid and the protective system.')}</p></div><div class="research-paper"><span class="paper-type">{tr(lang, 'TRABAJO EN ACTAS · COAUTORÍA', 'CONFERENCE PAPER · CO-AUTHOR')}</span><h3><a href="{href(path, route(lang, 'investigacion', primary['slug']))}">{e(primary['referenceTitle'].title())}</a></h3><p>{e(' · '.join(primary['authors']))}</p>{image_figure(primary, path, lang, metadata=False)}<a class="button button-primary" href="{href(path, route(lang, 'investigacion', primary['slug']))}">{tr(lang, 'Explorar la investigación', 'Explore the research')} ↗</a><span class="research-format">{tr(lang, 'C000391 · Presentación breve en línea (SOP) · Conferencia híbrida', 'C000391 · Online short oral presentation (SOP) · Hybrid conference')}</span></div></div><div class="publication-list">'''
    for item in RESEARCH['items'][1:]:
        body += f'<article><span class="publication-year">{item["year"]}</span><div><span class="eyebrow">{e(item[lang].get("category", ""))}</span><h3><a href="{href(path, route(lang, "investigacion", item["slug"]))}">{e(item[lang]["title"])}</a></h3><p>{e(item[lang].get("subtitle", ""))}</p></div><a class="publication-arrow" href="{href(path, route(lang, "investigacion", item["slug"]))}" aria-label="{e(item[lang]["title"])}">↗</a></article>'
    body += '</div>'
    if RESEARCH.get('activities'):
        body += f'<details class="academic-activities"><summary>{tr(lang, "Presentaciones, colaboración académica y voluntariado", "Presentations, academic collaboration and volunteering")}</summary><div class="activity-grid">'
        for activity in RESEARCH['activities']:
            a = activity[lang]
            body += f'<article><span>{e(a.get("type", ""))}</span><h3>{e(a["title"])}</h3><p>{e(a["description"])}</p><small>{e(a.get("evidence", ""))}</small>{references(activity, lang).replace("id=\"referencias\"", "")}</article>'
        body += '</div></details>'
    body += '</div></section>'
    body += f'<section class="section career-section" id="experiencia"><div class="container">{heading("03", tr(lang, "Experiencia que<br>conecta disciplinas.", "Experience across<br>structural disciplines."), tr(lang, "De edificaciones e infraestructura eléctrica a ingeniería para minería. Diseño, análisis, revisión y coordinación en equipos multidisciplinarios.", "From buildings and electrical infrastructure to mining engineering. Design, analysis, review and coordination within multidisciplinary teams."), lang)}<div class="career-editorial"><div class="career-statement"><span class="eyebrow">{tr(lang, "PRÁCTICA PROFESIONAL", "PROFESSIONAL PRACTICE")}</span><p>{tr(lang, "Cada estructura exige una lectura propia: cómo recibe las acciones, cómo las transmite y cómo se construye.", "Every structure requires its own understanding: how it receives loads, how it transfers them and how it is built.")}</p><a class="text-link" href="{href(path, f"assets/cv-sergio-ambrosio-{lang}.pdf")}">{tr(lang, "Trayectoria completa en PDF", "Full experience in PDF")} ↓</a></div><ol class="career-list">'
    for experience in PROFILE['experience']:
        body += f'<li><div class="career-date">{e(experience["period"][lang])}</div><div><h3>{e(experience["company"])}</h3><strong>{e(experience["role"][lang])}</strong><p>{e(experience["description"][lang])}</p><ul>{"".join(f"<li>{e(r)}</li>" for r in experience["responsibilities"][lang])}</ul></div></li>'
    body += '</ol></div></div></section>'
    body += f'<section class="section expertise-section" id="especialidades"><div class="container">{heading("04", tr(lang, "Criterio estructural.<br>Herramientas con propósito.", "Structural judgement.<br>Purposeful tools."), tr(lang, "La capacidad de un modelo depende de sus hipótesis, de la interpretación de sus resultados y de las decisiones que permite sustentar.", "A model is only as useful as its assumptions, the interpretation of its results and the decisions it can support."), lang)}<div class="expertise-grid">'
    for i, spec in enumerate(PROFILE['expertise'], 1):
        body += f'<article><span class="expertise-number">{i:02d}</span><h3>{e(spec["title"][lang])}</h3><p>{e(spec["description"][lang])}</p><details><summary>{tr(lang, "Método y aplicaciones", "Method and applications")}</summary><p>{e(spec["method"][lang])}</p>'
        apps = spec.get('applications', {})
        if isinstance(apps, dict) and apps.get(lang):
            applications = apps[lang]
            body += '<ul>' + ''.join(f'<li>{e(a)}</li>' for a in (applications if isinstance(applications, list) else [applications])) + '</ul>'
        body += f'</details><span class="tool-names">{e(" · ".join(spec["tools"]))}</span></article>'
    body += '</div></div></section>'
    body += automation_home(path, lang, AUTOMATION)
    body += f'<section class="section insights-section" id="notas"><div class="container">{heading("05", tr(lang, "Notas desde<br>la ingeniería.", "Notes on<br>engineering practice."), tr(lang, "Modelar, interpretar y verificar. Artículos con fundamentos, ejemplos calculados, código y referencias para desarrollar criterio técnico.", "Model, interpret and verify. Articles with fundamentals, worked examples, source code and references to support engineering judgement."), lang)}<div class="insight-list">'
    for i, item in enumerate(INSIGHTS['items'], 1):
        data = item[lang]
        link = href(path, route(lang, 'notas', item['slug']))
        body += f'<article><span class="insight-index">{i:02d}</span><a class="insight-image" href="{link}" aria-label="{e(data["title"])}"><img src="{href(path, item["image"]["src"])}" width="360" height="228" loading="lazy" alt="{e(data.get("imageAlt", ""))}"></a><div><span class="eyebrow">{e(data.get("category", ""))}</span><h3><a href="{link}">{e(data["title"])}</a></h3><p>{e(data["summary"])}</p></div><a class="insight-arrow" href="{link}" aria-label="{e(data["title"])}">↗</a></article>'
    body += '</div>'
    if INSIGHTS.get('regulatory'):
        reg = INSIGHTS['regulatory'][lang]
        body += f'<aside class="regulatory-note"><div><span class="eyebrow">{tr(lang, "NOVEDADES NORMATIVAS", "CODE UPDATES")} · {PROFILE["lastReviewed"]}</span><h3>{e(reg["title"])}</h3></div><div><p>{e(reg["description"])}</p><p>{e(reg.get("status", ""))}</p>{references(INSIGHTS["regulatory"], lang).replace("id=\"referencias\"", "id=\"referencias-normativas\"")}</div></aside>'
    body += '</div></section>'
    portrait = PROFILE.get('portrait')
    portrait_html = f'<figure class="professional-portrait"><img src="{href(path, portrait["src"])}" alt="{e(PROFILE["name"])}" width="640" height="800" loading="lazy"><figcaption>{e(loc(portrait.get("caption", ""), lang))}</figcaption></figure>' if portrait else '<div class="about-monogram" aria-hidden="true">SA<span>STRUCTURAL<br>ENGINEERING</span></div>'
    body += f'<section class="section about-section" id="perfil"><div class="container about-layout">{portrait_html}<div><span class="eyebrow">06 / {tr(lang, "SOBRE MÍ", "ABOUT")}</span><h2>{e(PROFILE["name"])}</h2><p class="degree">{e(PROFILE["degree"][lang])}</p><p>{e(PROFILE["summary"][lang])}</p><div class="education-note">' + ''.join(f'<p>{e(x[lang])}</p>' for x in PROFILE['education']) + f'</div><div class="about-actions"><a class="button button-dark" href="{href(path, f"assets/cv-sergio-ambrosio-{lang}.pdf")}" download>{tr(lang, "Descargar CV", "Download CV")} ↓</a>{ext(PROFILE["linkedin"], "LinkedIn")}</div></div></div></section>'
    body += f'<section class="section tools-section" id="herramientas"><div class="container"><div class="tools-heading"><div><span class="eyebrow">07 / STRUCTURAL LAB</span><h2>{tr(lang, "Modelos, código y exploración.", "Models, code and exploration.")}</h2></div><p>{tr(lang, "Desarrollos complementarios, estudios y propuestas en su estado actual.", "Supporting tools, studies and proposals, with their current development status.")}</p></div><div class="filter-bar" role="group" aria-label="{tr(lang, "Filtrar desarrollos", "Filter developments")}">'
    for key, es, en in [('todos', 'Todos', 'All'), ('analisis', 'Análisis', 'Analysis'), ('automatizacion', 'Automatización', 'Automation'), ('investigacion', 'Propuestas', 'Proposals')]:
        body += f'<button type="button" data-filter="{key}" aria-pressed="{str(key == "todos").lower()}" class="{"active" if key == "todos" else ""}">{tr(lang, es, en)}</button>'
    body += f'</div><p id="filter-status" class="sr-only" aria-live="polite">4 {tr(lang, "proyectos disponibles", "projects available")}</p><div class="lab-case-grid">'
    for key, case in LAB[lang].items():
        cat = {'cfrp': 'analisis', 'e030': 'automatizacion', 'lisp': 'automatizacion', 'columnas': 'investigacion'}[key]
        body += f'<article class="project-card" data-category="{cat}"><span class="eyebrow">{e(case["eyebrow"])}</span><h3><a href="{href(path, ("en/" if lang == "en" else "") + case["doc"])}" data-project="{key}">{e(case["title"])}</a></h3><p>{e(case["intro"])}</p><a class="text-link" href="{href(path, ("en/" if lang == "en" else "") + case["doc"])}">{tr(lang, "Leer ficha", "Read case study")} ↗</a></article>'
    body += f'</div><details class="beam-disclosure" id="laboratorio"><summary>{tr(lang, "Laboratorio interactivo · Equilibrio de una viga", "Interactive lab · Beam equilibrium")}</summary><div class="lab-section">{(ROOT / "templates" / f"lab-{lang}.html").read_text(encoding="utf-8")}</div></details></div></section>'
    body += f'<section class="contact-section" id="contacto"><div class="container contact-layout"><div><span class="eyebrow">08 / {tr(lang, "CONTACTO PROFESIONAL", "PROFESSIONAL CONTACT")}</span><h2>{tr(lang, "Conversemos sobre<br>ingeniería estructural.", "Let’s talk about<br>structural engineering.")}</h2><p>{tr(lang, "Oportunidades en minería, infraestructura, edificaciones y análisis avanzado.", "Opportunities in mining, infrastructure, buildings and advanced analysis.")}</p></div><div class="contact-links"><a id="linkedin-link" class="contact-big" href="{e(PROFILE["linkedin"])}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><a id="github-link" class="contact-small" href="{e(PROFILE["github"])}" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a id="email-link" class="contact-small" {("href=\"mailto:" + e(PROFILE["email"]) + "\"") if PROFILE["email"] else "hidden"}>{tr(lang, "Correo profesional", "Professional email")} ↗</a><a class="contact-small" href="{href(path, f"assets/cv-sergio-ambrosio-{lang}.pdf")}">{tr(lang, "CV profesional", "Professional CV")} ↓</a></div></div></section></main>'
    body += (ROOT / 'templates' / f'dialog-{lang}.html').read_text(encoding='utf-8')
    schema = {'@context': 'https://schema.org', '@type': 'Person', 'name': PROFILE['name'], 'jobTitle': tr(lang, 'Ingeniero estructural', 'Structural Engineer'), 'url': BASE, 'sameAs': [PROFILE['github'], PROFILE['linkedin']], 'alumniOf': {'@type': 'CollegeOrUniversity', 'name': 'Universidad Nacional de Ingeniería'}}
    body += '<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c') + '</script>'
    emit(path, body + footer(path, lang))


def cv(lang):
    path = f'cv/{lang}.html'
    title = tr(lang, 'Currículum profesional', 'Professional CV')
    text = f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="{e(PROFILE["degree"][lang])}"><title>{title} — Sergio Ambrosio</title><link rel="stylesheet" href="cv.css"></head><body><main><header><p class="kicker">STRUCTURAL ENGINEERING</p><h1>{e(PROFILE["name"])}</h1><p class="degree">{e(PROFILE["degree"][lang])}</p><p>{e(PROFILE["headline"][lang])}</p><div class="links"><a href="{BASE + ("en/" if lang == "en" else "")}">{tr(lang, "Portafolio", "Portfolio")}</a> · <a href="{e(PROFILE["linkedin"])}">LinkedIn</a> · <a href="{e(PROFILE["github"])}">GitHub</a></div></header><section><h2>{tr(lang, "Perfil", "Profile")}</h2><p>{e(PROFILE["summary"][lang])}</p></section><section><h2>{tr(lang, "Experiencia profesional", "Professional experience")}</h2>'
    for ex in PROFILE['experience']:
        text += f'<article><div class="role-head"><h3>{e(ex["company"])}</h3><span>{e(ex["period"][lang])}</span></div><strong>{e(ex["role"][lang])}</strong><ul>' + ''.join(f'<li>{e(x)}</li>' for x in ex['responsibilities'][lang]) + '</ul></article>'
    text += f'</section><section class="page-two"><h2>{tr(lang, "Proyectos seleccionados", "Selected projects")}</h2>'
    for item in PROJECTS['items']:
        text += f'<article><h3><a href="{BASE + route(lang, "proyectos", item["slug"])}">{e(item[lang]["title"])} · {item["year"]}</a></h3><p>{e(item[lang]["summary"])}</p></article>'
    text += f'</section><section><h2>{tr(lang, "Investigación y publicaciones", "Research and publications")}</h2>'
    for item in RESEARCH['items']:
        text += f'<article><h3><a href="{BASE + route(lang, "investigacion", item["slug"])}">{e(item.get("referenceTitle", item[lang]["title"]))}</a></h3><p>{e("; ".join(item["authors"]))} · {item["year"]}</p><p>{e(item[lang].get("subtitle", ""))}</p></article>'
    text += f'</section><section><h2>{tr(lang, "Especialidades y herramientas", "Expertise and tools")}</h2><p>' + e(' · '.join(x['title'][lang] for x in PROFILE['expertise'])) + '</p><p>' + e(' · '.join(dict.fromkeys(t for x in PROFILE['expertise'] for t in x['tools']))) + '</p>'
    text += f'<p><strong>{tr(lang,"Normativa y verificación","Codes and verification")}:</strong> RNE E.020 / E.030 / E.050 / E.060; ACI 318, ASCE 7, AISC 360, ASCE 41, ACI 562. <a href="{BASE + ("en/" if lang == "en" else "") + "normativa/index.html"}">{tr(lang,"Alcances y ediciones de referencia","Scope and reference editions")}</a>.</p>'
    text += f'<p><strong>Python / AutoLISP:</strong> {tr(lang,"procesamiento de resultados, validación y documentación. Demostradores nuevos del portafolio (2026)","results processing, validation and documentation. New portfolio demonstrations (2026)")}: <a href="{BASE + route(lang,"laboratorio","resultados-por-nivel")}">CSV / SI</a> · <a href="{BASE + route(lang,"laboratorio","voladizo-parametrico")}">{tr(lang,"voladizo paramétrico","parametric cantilever")}</a>.</p>'
    text += f'</section><section><h2>{tr(lang, "Formación", "Education")}</h2>' + ''.join(f'<p>{e(x[lang])}</p>' for x in PROFILE['education']) + f'</section><footer>{tr(lang, "Versión pública", "Public version")} · {PROFILE["lastReviewed"]} · sergioambrosio714.github.io</footer></main></body></html>'
    emit(path, text)


def readme():
    rows = '\n'.join(f'- **[{x["es"]["title"]}]({BASE + route("es", "proyectos", x["slug"])})** — {x["year"]}. {x["es"].get("subtitle", "")}' for x in PROJECTS['items'])
    pubs = '\n'.join(f'- **{x["year"]} · [{x.get("referenceTitle", x["es"]["title"]).title()}]({BASE + route("es", "investigacion", x["slug"])})**' for x in RESEARCH['items'])
    return f'''<!-- Generated by portfolio/scripts/build.py from portfolio/data/. -->
![Sergio Ambrosio — Structural Engineering](assets/banner.svg)

# {PROFILE['name']}

**{PROFILE['degree']['es']}.**

{PROFILE['headline']['en']}

Diseño, modelación y revisión de estructuras de acero y concreto. Actualmente desarrollo ingeniería estructural para minería en **SRK**, con trayectoria en edificaciones e infraestructura eléctrica en HMV, MRZ, AMEC Foster Wheeler y MIMCO.

[Portafolio en español]({BASE}) · [Portfolio in English]({BASE}en/index.html) · [CV PDF]({BASE}assets/cv-sergio-ambrosio-es.pdf) · [LinkedIn]({PROFILE['linkedin']})

### Proyectos seleccionados

{rows}

### Investigación y publicaciones

{pubs}

Coautor en **17WCEE** y expositor de una presentación breve en línea (SOP) del congreso híbrido de 2021. Las fichas enlazan las fuentes originales y distinguen publicaciones, presentaciones y actividades académicas.

### Normativa, análisis y verificación

Marco de aplicación declarado: RNE E.020, E.030, E.050 y E.060; ACI 318, ASCE/SEI 7, AISC 360, ASCE/SEI 41, ACI 562 y referencias FRP. [Ediciones, alcance y fuentes oficiales]({BASE}normativa/index.html). Análisis sísmico y no lineal, elementos finitos y reforzamiento; ETABS, SAP2000, SAFE, Mathcad, OpenSeesPy y Abaqus vinculados al problema estructural.

### Python comprobable

- [Resultados por nivel]({BASE}laboratorio/resultados-por-nivel.html): importar CSV, validar unidades, comparar casos y exportar datos.
- [Voladizo paramétrico]({BASE}laboratorio/voladizo-parametrico.html): equilibrio, deformación y esfuerzos con solución analítica.
- [Código Python, ejemplos y pruebas](https://github.com/SergioAmbrosio714/SergioAmbrosio714.github.io/tree/main/python).

Demostraciones desarrolladas para este portafolio en octubre de 2026; no se atribuyen a proyectos profesionales anteriores. Python complementa el criterio de diseño y la revisión, con procedimientos reproducibles y salidas trazables.

[Notas técnicas]({BASE}#notas) · [Experiencia profesional]({BASE}#experiencia) · [Structural Lab]({BASE}#herramientas)
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    global PROFILE, PROJECTS, RESEARCH, INSIGHTS, LAB, STANDARDS, AUTOMATION
    PROFILE, PROJECTS, RESEARCH, INSIGHTS = [read(x) for x in ('profile', 'projects', 'research', 'insights')]
    STANDARDS, AUTOMATION = read('standards'), read('automation')
    for collection in (PROJECTS, RESEARCH, INSIGHTS):
        for item in collection['items']:
            image = item.get('image')
            if image:
                image.setdefault('description', {lang: item[lang].get('imageAlt', '') for lang in ('es', 'en')})
                source = ROOT / image['src']
                if source.suffix == '.svg':
                    viewbox = re.search(r'viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"', source.read_text(encoding='utf-8'))
                    if viewbox:
                        image.setdefault('width', int(float(viewbox[1])))
                        image.setdefault('height', int(float(viewbox[2])))
    LAB = {'es': read('lab')['es'], 'en': read('lab-en')}
    emit('profile-data.js', '// Generated from data/. Edit the sources, then run python scripts/build.py.\n' + 'globalThis.PORTFOLIO_DATA = ' + json.dumps({'profile': {k: PROFILE[k] for k in ('name', 'github', 'email', 'linkedin')}, 'projects': LAB}, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + ';')
    for lang in ('es', 'en'):
        home(lang)
        cv(lang)
        code_path = ('en/' if lang == 'en' else '') + 'normativa/index.html'
        counterpart = ('en/' if lang == 'es' else '') + 'normativa/index.html'
        emit(code_path, head(code_path, lang, STANDARDS[lang]['title'], STANDARDS[lang]['intro'], counterpart) + header(code_path, lang, counterpart) + standards_page(code_path, lang, STANDARDS) + footer(code_path, lang))
        for demo in AUTOMATION['demos']:
            demo_path = route(lang, 'laboratorio', demo['slug'])
            counterpart = route(tr(lang, 'en', 'es'), 'laboratorio', demo['slug'])
            sample = (ROOT / demo['example']).read_text(encoding='utf-8')
            body = head(demo_path, lang, demo[lang]['title'], demo[lang]['description'], counterpart).replace('</head>', f'<script src="{href(demo_path, "demo-core.js")}" defer></script><script src="{href(demo_path, "demo-ui.js")}" defer></script></head>')
            emit(demo_path, body + header(demo_path, lang, counterpart) + demo_page(demo_path, lang, demo, sample) + footer(demo_path, lang))
        for group, collection in [('proyectos', PROJECTS), ('investigacion', RESEARCH), ('notas', INSIGHTS)]:
            for item in collection['items']:
                article(item, group, lang)
    images = [x['image'] for col in (PROJECTS, RESEARCH, INSIGHTS) for x in col['items'] if x.get('image')]
    emit('data/image-manifest.json', json.dumps({'reviewed': PROFILE['lastReviewed'], 'images': images}, ensure_ascii=False, indent=2))
    all_pages = sorted(set(p for p in OUTPUT if p.endswith('.html') and not p.startswith('cv/')) | {p.relative_to(ROOT).as_posix() for p in ROOT.glob('casos/*.html')} | {p.relative_to(ROOT).as_posix() for p in ROOT.glob('en/casos/*.html')})
    emit('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(f'<url><loc>{BASE + ("" if p == "index.html" else p)}</loc><lastmod>{PROFILE["lastReviewed"]}</lastmod></url>' for p in all_pages) + '\n</urlset>')
    profile_repo = ROOT.parent / 'github-profile'
    if profile_repo.is_dir():
        emit('../github-profile/README.md', readme())
    stale = []
    for name, value in OUTPUT.items():
        target = ROOT / name
        if not target.exists() or target.read_text(encoding='utf-8') != value:
            stale.append(name)
            if not args.check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(value, encoding='utf-8', newline='\n')
    if args.check and stale:
        raise SystemExit('Generated files are out of date: ' + ', '.join(stale))
    print(f'{"Verified" if args.check else "Built"} {len(OUTPUT)} static outputs; {len(stale)} {"stale" if args.check else "updated"}.')


if __name__ == '__main__':
    main()
