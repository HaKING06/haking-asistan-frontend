"""Çevrimdışı hata sınıflandırma, güvenli sözdizimi inceleme ve açıklamalar."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ErrorRule:
    pattern: str
    category: str
    title: str
    cause: str
    fix: str
    languages: tuple[str, ...] = ()
    severity: str = "Orta"
    official_url: str = ""


RULES = [
    ErrorRule(r"SyntaxError|invalid syntax|unexpected token|parse error|CS100[1-9]|TS10(?:05|09|11|13|15|17|19)|TS1109|TS1128|expression expected|declaration expected|';' expected|expected.*token|expected .* before", "Sözdizimi", "Sözdizimi hatası", "Dilbilgisi kuralı bozulmuş olabilir: eksik parantez, tırnak, noktalı virgül veya yanlış yerleşmiş bir ifade.", "Hata satırının hemen öncesindeki satırları da kontrol et. Açılan parantez/tırnakların kapandığını ve ifadelerin dilin söz dizimine uyduğunu doğrula.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust", "SQL", "HTML/CSS"), official_url="https://docs.python.org/3/reference/grammar.html"),
    ErrorRule(r"IndentationError|unexpected indent|unindent does not match|TabError|indentation", "Girinti", "Girinti veya blok hizası", "Python gibi girintiyi blok yapısı sayan dillerde boşluk/tab uyumsuzluğu ya da yanlış blok seviyesi var.", "Dosyada tab ve boşlukları karıştırma; aynı bloktaki satırları aynı girintiyle hizala. Python'da çoğunlukla 4 boşluk kullanılır.", ("Python",), official_url="https://docs.python.org/3/reference/lexical_analysis.html#indentation"),
    ErrorRule(r"NameError|ReferenceError|is not defined|not defined|undefined variable|Undefined variable|CS0103|TS2304|cannot find symbol|undeclared identifier|not declared in this scope", "Tanımsız ad", "Değişken, işlev veya sembol bulunamadı", "Kod bir değişkeni, metodu, sınıfı ya da sembolü kullanıyor ancak o ad geçerli kapsamda tanımlı değil.", "Yazımı ve büyük/küçük harfleri karşılaştır; tanımın kullanım öncesinde ve doğru kapsamda olduğuna, gerekli import/using satırının bulunduğuna bak.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#NameError"),
    ErrorRule(r"TypeError|Type mismatch|incompatible types|cannot implicitly convert|mismatched types|CS0029|CS1503|TS2322|TS2345|unsupported operand|not a function|not callable", "Tür uyuşmazlığı", "Tür uyuşmazlığı veya geçersiz işlem", "Bir işlem, fonksiyon çağrısı ya da atama beklenen türle uyumlu olmayan bir değer almış olabilir.", "İşleme giren değerlerin türlerini kontrol et; gerekiyorsa açık dönüşüm yap veya fonksiyonun beklediği parametre ve dönüş tipini düzelt.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#TypeError"),
    ErrorRule(r"ModuleNotFoundError|ImportError|Cannot find module|cannot find package|CS0246|TS2307|No module named|ClassNotFoundException|failed to open stream|could not find module", "Bağımlılık", "Modül veya paket bulunamadı", "Program gerekli modül/paketi bulamıyor; paket kurulmamış, adı farklı yazılmış veya çalışma ortamı yanlış olabilir.", "Hata mesajındaki modül adını doğrula; doğru sanal ortamda bağımlılığı kur ve import yolunun/proje klasörünün doğru olduğundan emin ol.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#ImportError"),
    ErrorRule(r"AttributeError|NoneType.*attribute|Cannot read propert(?:y|ies) of (?:undefined|null)|NullReferenceException|NullPointerException|on null|undefined is not an object", "Null / eksik değer", "Boş veya başlatılmamış değer kullanımı", "Kod, null/None/undefined olabilen bir nesnenin özelliğine veya metoduna erişiyor.", "Değişkenin nerede oluşturulduğunu ve hangi durumda boş kalabileceğini bul; kullanmadan önce null/None kontrolü ekle ya da başlangıç değerini garanti et.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP"), official_url="https://docs.python.org/3/library/exceptions.html#AttributeError"),
    ErrorRule(r"IndexError|out of range|ArrayIndexOutOfBoundsException|IndexOutOfBoundsException|list index out of range|index.*outside|undefined.*index", "Dizin sınırı", "Dizi veya liste sınırı aşıldı", "Kod geçerli öğe aralığının dışında bir indekse erişiyor; liste boş olabilir veya döngü sınırı fazla ilerliyor.", "Uzunluğu kontrol et; son geçerli indeksin length - 1 olduğunu unutma. Döngü sınırını ve boş koleksiyon durumunu gözden geçir.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#IndexError"),
    ErrorRule(r"KeyError|key not found|NoSuchKey|undefined array key|does not contain a definition for key", "Eksik anahtar", "Sözlük veya kayıt anahtarı bulunamadı", "İstenen anahtar koleksiyonda bulunmuyor veya anahtarın yazımı/veri biçimi beklenenden farklı.", "Anahtarın varlığını kontrol et; opsiyonel erişim ya da varsayılan değer kullan. JSON/API alan adının harf durumunu ve şemasını doğrula.", ("Python", "JavaScript/TypeScript", "PHP"), official_url="https://docs.python.org/3/library/exceptions.html#KeyError"),
    ErrorRule(r"FileNotFoundError|No such file or directory|ENOENT|Could not find file|file not found|failed to open stream", "Dosya yolu", "Dosya veya yol bulunamadı", "Dosya mevcut değil, göreli yol beklenenden farklı bir çalışma dizinine göre çözülüyor ya da dosya adı büyük/küçük harf açısından farklı.", "Dosyanın gerçekten var olduğunu ve uygulamanın çalışma dizinini kontrol et; göreli yol yerine uygun mutlak/proje köküne göre yol kullan.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#FileNotFoundError"),
    ErrorRule(r"PermissionError|Permission denied|EACCES|UnauthorizedAccessException|access is denied|operation not permitted", "İzin", "Dosya veya işlem izni yok", "İşletim sistemi bu dosya/klasör üzerinde gereken okuma, yazma veya çalıştırma iznini vermiyor.", "Dosya izinlerini, sahipliği ve kullanılan yolu kontrol et. Uygulamaya gereksiz yönetici yetkisi vermek yerine gerekli klasör iznini düzelt.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#PermissionError"),
    ErrorRule(r"TimeoutError|timed out|ETIMEDOUT|Connection refused|ECONNREFUSED|could not connect|network is unreachable|Name or service not known", "Bağlantı", "Ağ veya servis bağlantısı başarısız", "Hedef sunucu kapalı olabilir, adres/port yanlış olabilir veya ağ/zaman aşımı sorunu yaşanıyor.", "Servis durumunu ve URL/portu doğrula; DNS, güvenlik duvarı ve bağlantı zaman aşımını kontrol et. Gizli anahtarları hata metnine ekleme.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "Go", "Rust", "SQL"), official_url="https://docs.python.org/3/library/exceptions.html#TimeoutError"),
    ErrorRule(r"SQLSTATE|syntax error at or near|relation .* does not exist|no such table|duplicate key|constraint failed|foreign key constraint|database is locked|OperationalError", "Veritabanı", "SQL veya veritabanı işlemi başarısız", "Sorgu söz dizimi, tablo/kolon adı, kısıt veya bağlantı varsayımı gerçek veritabanı şemasıyla uyuşmuyor olabilir.", "SQLSTATE/hata kodunu sakla; sorgu parametrelerini kullan, tablo ve kolon adlarını şemayla karşılaştır, migration durumunu ve transaction'ı denetle. Parola/URL paylaşma.", ("SQL", "Python", "JavaScript/TypeScript", "C#", "Java", "PHP"), official_url="https://www.postgresql.org/docs/current/errcodes-appendix.html"),
    ErrorRule(r"ZeroDivisionError|division by zero|ArithmeticException.*zero|divide by zero", "Aritmetik", "Sıfıra bölme", "İşlemde payda sıfır olabilir veya beklenmeyen veri hesaplamaya girmiş olabilir.", "Bölme işleminden önce paydanın sıfır olup olmadığını kontrol et; sıfır durumunda beklenen davranışı açıkça tanımla.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#ZeroDivisionError"),
    ErrorRule(r"RecursionError|Maximum call stack size exceeded|StackOverflowException|stack overflow", "Özyineleme", "Çağrı yığını sınırı aşıldı", "Özyinelemeli fonksiyonun durma koşulu eksik olabilir veya çağrı zinciri çok derinleşmiş olabilir.", "Temel durumu ve her çağrıda problemin küçüldüğünü doğrula; gerekirse döngülü/iteratif çözüme geç.", ("Python", "JavaScript/TypeScript", "C#", "Java"), official_url="https://docs.python.org/3/library/exceptions.html#RecursionError"),
    ErrorRule(r"AssertionError|assertion failed|assert failed|expected .* but was", "Beklenti uyuşmazlığı", "Doğrulama koşulu başarısız", "Kod veya test bir koşulun doğru olmasını bekliyor ancak gerçekleşen değer farklı.", "Beklenen ve gerçek değerleri karşılaştır; başarısız koşulun girdilerini, sınır durumlarını ve test varsayımlarını incele.", ("Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "C/C++", "Go", "Rust"), official_url="https://docs.python.org/3/library/exceptions.html#AssertionError"),
]


TRAINING_EXAMPLES = {
    "Sözdizimi": [
        "SyntaxError invalid syntax unexpected token missing semicolon expected token Parse error",
        "CS1002 ; expected CS1513 } expected Java ';' expected PHP Parse error unexpected token",
        "Rust expected one of ; or } Go syntax error unexpected newline C++ expected primary expression",
        "SQL syntax error near FROM HTML unexpected closing tag missing quote",
        "unterminated string literal unmatched parenthesis unexpected end of input missing bracket",
    ],
    "Girinti": [
        "IndentationError unexpected indent unindent does not match any outer indentation level TabError inconsistent use of tabs and spaces",
        "Python expected an indented block after if statement indentation level does not match",
        "unexpected indent at function body mixing tabs and spaces Python block indentation error",
    ],
    "Tanımsız ad": [
        "NameError name x is not defined ReferenceError x is not defined variable not defined",
        "CS0103 The name x does not exist in the current context Java cannot find symbol",
        "PHP Undefined variable C++ undeclared identifier Go undefined Rust cannot find value in this scope",
        "unknown identifier variable was never declared function name is not defined in this scope",
    ],
    "Tür uyuşmazlığı": [
        "TypeError unsupported operand type(s) can only concatenate str and int not a function",
        "CS0029 Cannot implicitly convert type CS1503 argument cannot convert incompatible types",
        "Java incompatible types Rust mismatched types expected found PHP argument must be of type",
        "cannot convert string to integer invalid operand type function expected a number got text",
    ],
    "Bağımlılık": [
        "ModuleNotFoundError No module named ImportError cannot import name Cannot find module",
        "CS0246 type or namespace name could not be found Java ClassNotFoundException",
        "Cannot find package failed to open stream PHP include require module not found Rust unresolved import",
        "package dependency is missing import path cannot be resolved library is not installed",
    ],
    "Null / eksik değer": [
        "AttributeError NoneType object has no attribute Cannot read properties of undefined Cannot read properties of null",
        "NullReferenceException Object reference not set to an instance NullPointerException",
        "PHP Attempt to read property on null undefined is not an object",
        "object has no property because value is empty null reference access before initialization",
    ],
    "Dizin sınırı": [
        "IndexError list index out of range array index out of bounds ArrayIndexOutOfBoundsException",
        "IndexOutOfRangeException index was outside the bounds of the array Go index out of range",
        "Rust index out of bounds Java IndexOutOfBoundsException C++ vector subscript out of range",
        "array index is outside the valid range requested element does not exist in list",
    ],
    "Eksik anahtar": [
        "KeyError key not found NoSuchKey undefined array key PHP Undefined array key missing dictionary key",
        "requested dictionary key is missing object property key does not exist in data",
        "lookup key not present in map JSON field missing from response",
    ],
    "Dosya yolu": [
        "FileNotFoundError No such file or directory ENOENT Could not find file failed to open stream file not found",
        "path does not exist cannot open requested file wrong working directory missing input file",
        "file name or folder was not found configured path cannot be resolved",
    ],
    "İzin": [
        "PermissionError Permission denied EACCES UnauthorizedAccessException access is denied operation not permitted",
        "write access denied user does not have permission to read this directory",
        "operation not permitted cannot create output file access denied by operating system",
    ],
    "Bağlantı": [
        "TimeoutError timed out ETIMEDOUT Connection refused ECONNREFUSED network is unreachable DNS lookup failed",
        "could not connect to server host is unreachable request timed out no route to host",
        "service refused the connection invalid port connection timeout network error",
    ],
    "Veritabanı": [
        "SQLSTATE syntax error at or near relation does not exist no such table duplicate key constraint failed OperationalError database is locked",
        "database connection failed migration missing column violates foreign key constraint",
        "unique constraint violation table not found query references unknown database field",
    ],
    "Aritmetik": [
        "ZeroDivisionError division by zero ArithmeticException divide by zero cannot divide by zero",
        "cannot divide a number by zero divisor is zero arithmetic operation failed",
        "division by zero in calculation denominator evaluates to 0",
    ],
    "Özyineleme": [
        "RecursionError maximum recursion depth exceeded Maximum call stack size exceeded StackOverflowException",
        "recursive function exceeded stack limit recursion never reached base case",
        "too much recursion stack overflow because recursive call does not terminate",
    ],
    "Beklenti uyuşmazlığı": [
        "AssertionError assertion failed assert failed expected value but was different test assertion failed",
        "test expected 5 but got 4 condition should be true but was false",
        "validation assertion did not hold expected and actual result are different",
    ],
}


def make_training_data() -> tuple[list[str], list[str], list[str]]:
    messages: list[str] = []
    labels: list[str] = []
    groups: list[str] = []
    prefixes = ["", "Error: ", "Build failed: ", "Hata: ", "Derleme hatası: ", "Runtime error: "]
    suffixes = ["", " at line 12", " in main.py:8", " (exit code 1)", " uygulama başlatılamadı"]
    for category, templates in TRAINING_EXAMPLES.items():
        for template_index, template in enumerate(templates):
            for prefix in prefixes:
                for suffix in suffixes:
                    messages.append(f"{prefix}{template}{suffix}")
                    labels.append(category)
                    groups.append(f"{category}:{template_index}")
    return messages, labels, groups


def detect_location(text: str) -> tuple[int | None, int | None]:
    """Read common compiler and editor locations, including VS Code's Ln/Col form."""
    vscode = re.search(
        r"\b(?:Ln|line|satır)\s*[:#]?\s*(\d+)\s*[,;:]\s*"
        r"(?:Col|column|sütun)\s*[:#]?\s*(\d+)\b",
        text,
        re.IGNORECASE,
    )
    if vscode:
        return int(vscode.group(1)), int(vscode.group(2))
    patterns = [
        r"(?:--?>\s+)?[^\n:]*:(\d+):(\d+)\b", r"\((\d+)\s*,\s*(\d+)\)",
        r"\b(?:line|satır)\s*[:#]?\s*(\d+)\s*[,;:]\s*(?:column|col|sütun)\s*[:#]?\s*(\d+)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1)), int(match.group(2))
    line_only = re.search(r"\b(?:line|satır)\s*[:#]?\s*(\d+)\b", text, re.IGNORECASE)
    if line_only:
        return int(line_only.group(1)), None
    return None, None


def detect_line_number(text: str) -> int | None:
    """Backward-compatible helper used by existing callers."""
    return detect_location(text)[0]


def _line_context(source: str, line_number: int | None, column_number: int | None = None) -> str:
    if not source.strip() or line_number is None:
        return ""
    lines = source.splitlines()
    if not 1 <= line_number <= len(lines):
        return f"Mesaj satır {line_number} diyor ancak paylaşılan kod {len(lines)} satır. Kodun tam halini kontrol et."
    start, end = max(1, line_number - 1), min(len(lines), line_number + 1)
    snippet_lines = []
    for index in range(start, end + 1):
        line = lines[index - 1].expandtabs(4)
        marker = "➜" if index == line_number else " "
        snippet_lines.append(f"{marker} {index:>4} │ {line}")
        if index == line_number and column_number:
            pointer = " " * min(max(column_number - 1, 0), 240) + "^"
            snippet_lines.append(f"       │ {pointer} sütun {column_number}")
    return f"Hata mesajındaki satır çevresi:\n" + "\n".join(snippet_lines) + "\nNot: İşaretlenen konum derleyici/editör mesajından alınır; asıl neden bir önceki satırda olabilir."


def _detect_language(source: str, message: str, requested: str) -> tuple[str, float, str]:
    """Prefer explicit choice, otherwise infer from extensions and distinctive syntax."""
    if requested != "Otomatik":
        return requested, 1.0, "Kullanıcı seçimi"

    source = source[:12_000]
    message = message[:4_000]
    text = f"{source}\n{message}"
    extension_map = {
        ".py": "Python", ".js": "JavaScript/TypeScript", ".jsx": "JavaScript/TypeScript",
        ".ts": "JavaScript/TypeScript", ".tsx": "JavaScript/TypeScript", ".cs": "C#",
        ".java": "Java", ".php": "PHP", ".sql": "SQL", ".c": "C/C++", ".h": "C/C++",
        ".cpp": "C/C++", ".hpp": "C/C++", ".go": "Go", ".rs": "Rust", ".html": "HTML/CSS", ".css": "HTML/CSS",
    }
    ext_match = re.search(r"\b(?:in\s+)?[\w./\\-]+(\.py|\.jsx?|\.tsx?|\.cs|\.java|\.php|\.sql|\.cpp|\.hpp|\.c|\.h|\.go|\.rs|\.html|\.css)\b", message, re.IGNORECASE)
    if ext_match:
        return extension_map[ext_match.group(1).casefold()], .91, "Hata mesajındaki dosya uzantısı"
    if re.search(r"\bTS\d{4}\b", message, re.IGNORECASE):
        return "JavaScript/TypeScript", .99, "TypeScript tanı kodu"
    if re.search(r"\bCS\d{4}\b", message, re.IGNORECASE):
        return "C#", .99, "C# tanı kodu"
    if re.search(r"Traceback \(most recent call last\)|\b(?:ModuleNotFoundError|IndentationError|NameError|ZeroDivisionError)\b", message):
        return "Python", .98, "Python hata imzası"
    if re.search(r"unexpected closing tag|missing end tag|end tag .* seen|element .* not closed", message, re.IGNORECASE):
        return "HTML/CSS", .94, "HTML hata imzası"
    checks: list[tuple[str, str, float]] = [
        ("Python", r"^\s*(?:def |class |from \w+ import |import \w+|elif |except\b|print\s*\(|if .+:|for .+:|while .+:|try\s*:|with .+:)", .93),
        ("JavaScript/TypeScript", r"\b(?:const|let|var)\s+[A-Za-z_$]|\bfunction\s+\w+\s*\(|=>|console\.log|document\.|\bexport\s+(?:default|const|function)|\binterface\s+\w+", .88),
        ("HTML/CSS", r"<!doctype\s+html|<html\b|</(?:html|head|body|div|main|script|style)>|<meta\b|<body\b|<head\b", .98),
        ("HTML/CSS", r"(?:^|[;}\n])\s*[.#]?[A-Za-z][\w.#\s,:>+~-]*\s*\{\s*[\w-]+\s*:", .72),
        ("PHP", r"<\?php|\$[A-Za-z_]\w*\s*=|\b(?:echo|namespace)\s+", .95),
        ("SQL", r"\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|SQLSTATE)\b", .88),
        ("C#", r"\busing\s+System\s*;|Console\.WriteLine|namespace\s+[\w.]+|\b(?:public|private)\s+class\s+\w+", .94),
        ("Java", r"\bpublic\s+static\s+void\s+main\s*\(|System\.out\.print|\bpackage\s+[\w.]+;", .94),
        ("Go", r"^\s*package\s+main\b|\bfunc\s+main\s*\(|\bfmt\.Print|:=", .93),
        ("Rust", r"\bfn\s+main\s*\(|\blet\s+mut\b|println!\s*\(|\buse\s+std::", .94),
        ("C/C++", r"#\s*include\s*[<\"]|\bstd::|\bint\s+main\s*\(|\bcout\s*<<", .94),
    ]
    for language, pattern, confidence in checks:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return language, confidence, "Kod/hata imzası"

    return "Belirlenemedi", 0.0, "Yeterli dil ipucu yok"


def _python_syntax(source: str, language: str) -> ErrorRule | None:
    if language != "Python" or not source.strip():
        return None
    try:
        ast.parse(source)
    except (SyntaxError, IndentationError, TabError) as exc:
        is_indent = isinstance(exc, (IndentationError, TabError))
        category = "Girinti" if is_indent else "Sözdizimi"
        return ErrorRule(
            "", category, "Python kodunda sözdizimi hatası",
            str(exc.msg or "Python söz dizimi kodu ayrıştıramadı."),
            "İşaretlenen satırı ve bir önceki satırdaki açık parantez/tırnakları kontrol et. Satır numarası Python ayrıştırıcısından geldi.",
            ("Python",), "Orta", "https://docs.python.org/3/reference/grammar.html",
        )
    return None


def _syntax_guidance(message: str, language: str) -> tuple[str, str, str] | None:
    """Turn common parser wording into a concrete first fix, without guessing code."""
    normalized = message.casefold()
    if re.search(r"expression expected|expected expression|expression is expected|ts1109", normalized):
        return (
            "Sözdizimi hatası · ifade bekleniyor",
            "Derleyici bu konumda bir değer veya ifade bekliyor ama boş/eksik bir bölüm bulmuş. Sık nedenler: `=`, `return`, virgül ya da operatörden sonra ifade bırakılması; boş koşul/değer; önceki satırda kapanmayan parantez.",
            "İşaretli sütunun hemen öncesine bak. `=` sonrasında değer, `return` sonrasında ifade ve fonksiyon argümanlarında eksik parça var mı kontrol et. Bir önceki satırdaki `()`, `[]`, `{}` ve tırnakları da eşleştir; tek değişiklik yapıp tekrar derle.",
        )
    if re.search(r"';' expected|semicolon expected|ts1005|cs1002", normalized):
        return (
            "Sözdizimi hatası · noktalı virgül bekleniyor",
            "Derleyici, ifadenin bittiği yerde `;` bekliyor. Bazen eksik noktalı virgülün asıl nedeni, bir önceki satırda kapanmamış parantez veya tırnaktır.",
            "İşaretli satırın sonunu ve bir önceki satırı kontrol et. Dilin istediği yerde `;` ekle; HTML etiketlerinin sonuna gelişigüzel noktalı virgül ekleme. Sonra yeniden derleyip yeni ilk hata mesajını incele.",
        )
    if re.search(r"unexpected end|unexpected end of input|unterminated|unclosed|was never closed|reached end of file|end of file", normalized):
        return (
            "Sözdizimi hatası · ifade veya blok kapanmamış",
            "Dosya/ifade bittiğinde açılmış bir tırnak, parantez, dizi ya da kod bloğu kapanmamış olabilir.",
            "Hata konumundan geriye doğru son açılan `(`, `[`, `{`, tek/çift tırnağı bul ve eşini ekle. Çok satırlı metinlerde dilin doğru string sözdizimini kullan; blok kapanışını ekledikten sonra tekrar çalıştır.",
        )
    if re.search(r"unexpected token|unexpected character|invalid or unexpected token", normalized):
        return (
            "Sözdizimi hatası · beklenmeyen karakter/token",
            "İşaretlenen yerde dilin tanımadığı veya o sırada kabul etmediği bir token var. Bazen görünmeyen kopyalama karakteri ya da hatanın bir önceki satırda olması bu mesajı üretir.",
            "Satırı elle yeniden yazmayı dene; akıllı tırnak, fazladan virgül, yanlış parantez ve operatörleri kontrol et. Hata satırının üstündeki ifadeyi tamamla, sonra ilk derleme hatasına göre ilerle.",
        )
    if re.search(r"invalid syntax|syntaxerror|parse error|syntax error|cs100|ts10\d\d|ts1128|declaration expected", normalized):
        return (
            f"{language} sözdizimi hatası",
            "Parser kodu dilin gramerine göre ayrıştıramadı. Mesaj tek başına kesin sebebi göstermez; eksik ayraç/tırnak, hatalı ifade veya yanlış blok yerleşimi sık görülen nedenlerdir.",
            "Önce gösterilen satır ve sütunu, sonra hemen önceki satırı incele. Parantez ve tırnak çiftlerini eşleştir; ifadeyi küçük parçalara ayırıp bir değişiklikten sonra yeniden derle. Birden fazla hata varsa listedeki ilk hatadan başla.",
        )
    return None


def analyze_error(message: str, source: str = "", language: str = "Otomatik", classifier: Any = None) -> dict[str, Any]:
    message = (message or "").strip()[:20_000]
    source = (source or "")[:65_536]
    supplied_language = (language or "Otomatik").strip()
    language_aliases = {
        "python": "Python", "py": "Python", "javascript": "JavaScript/TypeScript", "js": "JavaScript/TypeScript",
        "typescript": "JavaScript/TypeScript", "ts": "JavaScript/TypeScript", "csharp": "C#", "c#": "C#",
        "c-sharp": "C#", "java": "Java", "php": "PHP", "sql": "SQL", "c": "C/C++", "c++": "C/C++",
        "cpp": "C/C++", "golang": "Go", "go": "Go", "rust": "Rust", "html": "HTML/CSS", "css": "HTML/CSS",
        "otomatik": "Otomatik", "auto": "Otomatik",
    }
    requested_language = language_aliases.get(supplied_language.casefold(), supplied_language)
    language, language_confidence, language_method = _detect_language(source, message, requested_language)
    if not message and not source:
        return {"recognized": False, "title": "Bir hata mesajı veya kod ekleyin", "cause": "", "fix": "", "confidence": 0.0, "line": None, "column": None, "context": "", "category": "Bilinmiyor", "language": language, "language_confidence": language_confidence, "language_method": language_method, "official_url": ""}

    python_rule = _python_syntax(source, language)
    matched = python_rule
    if matched is None:
        for rule in RULES:
            if rule.languages and language != "Belirlenemedi" and language not in rule.languages:
                continue
            if re.search(rule.pattern, message, re.IGNORECASE | re.MULTILINE):
                matched = rule
                break

    confidence = 0.98 if python_rule else (0.94 if matched else 0.0)
    predicted_category = matched.category if matched else "Bilinmiyor"
    if matched is None and message and classifier is not None:
        try:
            probabilities = classifier.predict_proba([message])[0]
            best_index = int(probabilities.argmax())
            candidate_confidence = float(probabilities[best_index])
            if candidate_confidence >= 0.42:
                predicted_category = str(classifier.classes_[best_index])
                confidence = candidate_confidence
                matched = next((rule for rule in RULES if rule.category == predicted_category), None)
        except Exception:
            # A rule-based answer is still available if an optional model artifact is damaged.
            pass

    line, column = detect_location(message)
    if python_rule is not None:
        try:
            ast.parse(source)
        except SyntaxError as exc:
            line = exc.lineno or line
            column = exc.offset or column

    if matched:
        title, cause, fix = matched.title, matched.cause, matched.fix
        if matched.category == "Sözdizimi":
            tailored = _syntax_guidance(message, language)
            if tailored:
                title, cause, fix = tailored
        official_url = matched.official_url
        if matched.category == "Sözdizimi":
            official_url = {
                "Python": "https://docs.python.org/3/reference/grammar.html",
                "JavaScript/TypeScript": "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Errors",
                "HTML/CSS": "https://developer.mozilla.org/docs/Web/HTML",
                "C#": "https://learn.microsoft.com/dotnet/csharp/language-reference/compiler-messages/",
                "Java": "https://docs.oracle.com/javase/specs/",
                "PHP": "https://www.php.net/manual/en/language.basic-syntax.php",
                "SQL": "https://www.postgresql.org/docs/current/sql-syntax.html",
                "C/C++": "https://en.cppreference.com/w/cpp/language.html",
                "Go": "https://go.dev/ref/spec",
                "Rust": "https://doc.rust-lang.org/reference/",
            }.get(language, "")
        recognized = confidence >= 0.3
    else:
        title = "Bu hata imzası katalogda eşleşmedi"
        cause = "Çevrimdışı çözümleyici her hata mesajını kesin tanıyamaz. Bu sonuç bir teşhis önerisidir; tam traceback ve ilgili kod bölümü olmadan kesin neden söylenemez."
        fix = "Tam hata metnini (gizli değerleri silerek), dili/sürümü ve hatanın çevresindeki kodu ekle. İstersen aşağıdaki çevrimiçi aktarım ile HaKING AI'da devam et."
        official_url = ""
        recognized = False

    return {
        "recognized": recognized,
        "title": title,
        "cause": cause,
        "fix": fix,
        "confidence": confidence,
        "line": line,
        "context": _line_context(source, line, column),
        "category": predicted_category,
        "language": language,
        "language_confidence": language_confidence,
        "language_method": language_method,
        "column": column,
        "official_url": official_url,
    }
