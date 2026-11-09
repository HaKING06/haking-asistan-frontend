"""Tkinter masaüstü arayüzü: çevrimdışı ürün arama ve hata analizi."""

from __future__ import annotations

import json
import queue
import re
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, X, Y, PhotoImage, StringVar, Tk, filedialog, messagebox, ttk

import joblib
import pandas as pd

from .data import ROOT
from .error_analyzer import _detect_language, analyze_error
from .model import HaKINGModel, MODEL_PATH
from .product_search import suggest_corrections, top_results


APP_VERSION = "0.1.2"
ERROR_MODEL_PATH = ROOT / "models" / "error_classifier.joblib"
METRICS_PATH = ROOT / "results" / "metrics.json"
ONLINE_URL = "https://ai.haking.tr/#chat-input"
MAX_FILE_BYTES = 65_536

COLORS = {
    "bg": "#0b0d12", "panel": "#12151d", "panel2": "#171a24", "line": "#282c39",
    "text": "#f1f0fb", "muted": "#9ba0b3", "purple": "#9276ff", "green": "#63d6ab",
    "amber": "#ffc76b", "red": "#ff777f", "input": "#0e1118",
}


class HaKINGDesktopApp:
    def __init__(self):
        self.root = Tk()
        self.root.title(f"HaKING AI Desktop · v{APP_VERSION}")
        self.root.geometry("1200x820")
        self.root.minsize(900, 680)
        self.root.configure(bg=COLORS["bg"])
        # Tk parses an unbraced family name as separate font fields and reads
        # "UI" as the size, raising TclError on Windows.
        self.root.option_add("*Font", "{Segoe UI} 10")
        self.brand_logo = None
        logo_path = ROOT / "assets" / "logo-mark.png"
        if logo_path.is_file():
            try:
                self.brand_logo = PhotoImage(file=str(logo_path)).subsample(8, 8)
                self.root.iconphoto(True, self.brand_logo)
            except Exception:
                self.brand_logo = None
        self.model: HaKINGModel | None = None
        self.error_classifier = None
        self.load_queue: queue.Queue = queue.Queue()
        self.batch_queue: queue.Queue = queue.Queue()
        self.active_language = StringVar(value="Otomatik")
        self.active_search_method = StringVar(value="Hibrit")
        self.analysis_mode = StringVar(value="Yazım hatalı ürün arama")
        self.bulk_mode = StringVar(value="Ürün sorguları")
        self.model_status = StringVar(value="Modeller yükleniyor…")
        self._configure_styles()
        self._build_shell()
        self._poll_model_load()
        threading.Thread(target=self._load_models, daemon=True).start()

    def _configure_styles(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(".", background=COLORS["bg"], foreground=COLORS["text"], font=("Segoe UI", 10))
        style.configure("TFrame", background=COLORS["bg"])
        style.configure("Panel.TFrame", background=COLORS["panel"], relief="solid", borderwidth=1,
                         bordercolor=COLORS["line"], lightcolor=COLORS["line"], darkcolor=COLORS["line"])
        style.configure("Subpanel.TFrame", background=COLORS["panel2"])
        style.configure("TLabel", background=COLORS["bg"], foreground=COLORS["text"])
        style.configure("Muted.TLabel", foreground=COLORS["muted"])
        style.configure("Title.TLabel", font=("Segoe UI", 21, "bold"), foreground=COLORS["text"])
        style.configure("Subtitle.TLabel", font=("Segoe UI", 10), foreground=COLORS["muted"])
        style.configure("Section.TLabel", font=("Segoe UI", 12, "bold"), foreground=COLORS["text"])
        style.configure("Accent.TLabel", foreground=COLORS["purple"])
        style.configure("Panel.TLabel", background=COLORS["panel"], foreground=COLORS["text"])
        style.configure("PanelMuted.TLabel", background=COLORS["panel"], foreground=COLORS["muted"])
        style.configure("PanelSection.TLabel", background=COLORS["panel"], foreground=COLORS["text"], font=("Segoe UI", 12, "bold"))
        style.configure("PanelAccent.TLabel", background=COLORS["panel"], foreground=COLORS["purple"])
        style.configure("PanelSubtitle.TLabel", background=COLORS["panel"], foreground=COLORS["muted"])
        style.configure("TButton", background=COLORS["panel2"], foreground=COLORS["text"], padding=(12, 8), borderwidth=0, focusthickness=0)
        style.map("TButton", background=[("active", "#29243c"), ("disabled", COLORS["panel2"])], foreground=[("disabled", "#656a79")])
        style.configure("Accent.TButton", background=COLORS["purple"], foreground="#fff", font=("Segoe UI", 10, "bold"), padding=(16, 9))
        style.map("Accent.TButton", background=[("active", "#a08aff")])
        style.configure("TEntry", fieldbackground=COLORS["input"], foreground=COLORS["text"], insertcolor=COLORS["text"], padding=10, borderwidth=0)
        style.configure("TCombobox", fieldbackground=COLORS["panel2"], background=COLORS["panel2"], foreground=COLORS["text"], arrowcolor=COLORS["purple"], padding=8, borderwidth=0)
        style.map("TCombobox", fieldbackground=[("readonly", COLORS["panel2"])], foreground=[("readonly", COLORS["text"])])
        style.configure("TNotebook", background=COLORS["bg"], borderwidth=0, tabmargins=(0, 0, 0, 0))
        style.configure("TNotebook.Tab", background=COLORS["bg"], foreground=COLORS["muted"], padding=(15, 10), borderwidth=0, font=("Segoe UI", 9, "bold"))
        style.map("TNotebook.Tab", background=[("selected", COLORS["panel2"])], foreground=[("selected", COLORS["text"])])
        style.configure("Treeview", background=COLORS["input"], fieldbackground=COLORS["input"], foreground=COLORS["text"], rowheight=34, borderwidth=0, relief="flat")
        style.configure("Treeview.Heading", background=COLORS["panel2"], foreground=COLORS["muted"], font=("Segoe UI", 9, "bold"), padding=(10, 9), relief="flat", borderwidth=0)
        style.map("Treeview", background=[("selected", "#33285c")])
        style.configure("TProgressbar", background=COLORS["purple"], troughcolor=COLORS["panel2"], bordercolor=COLORS["panel2"], lightcolor=COLORS["purple"], darkcolor=COLORS["purple"])
        style.configure("Vertical.TScrollbar", background=COLORS["panel2"], troughcolor=COLORS["bg"], arrowcolor=COLORS["muted"])

    def _build_shell(self):
        outer = ttk.Frame(self.root, padding=(20, 16))
        outer.pack(fill=BOTH, expand=True)
        header = ttk.Frame(outer)
        header.pack(fill=X, pady=(0, 14))
        brand = ttk.Frame(header)
        brand.pack(side=LEFT)
        if self.brand_logo is not None:
            ttk.Label(brand, image=self.brand_logo).pack(side=LEFT, padx=(0, 10))
        brand_copy = ttk.Frame(brand)
        brand_copy.pack(side=LEFT)
        ttk.Label(brand_copy, text="HaKING AI", style="Title.TLabel").pack(anchor="w")
        ttk.Label(brand_copy, text="Yazım hatalarına dayanıklı ürün arama · çevrimdışı kod hata analizi", style="Subtitle.TLabel").pack(anchor="w", pady=(3, 0))
        status = ttk.Label(header, textvariable=self.model_status, style="Accent.TLabel")
        status.pack(side=RIGHT, anchor="e")

        self.tabs = ttk.Notebook(outer)
        self.tabs.pack(fill=BOTH, expand=True)
        self.single_tab = ttk.Frame(self.tabs, padding=16)
        self.bulk_tab = ttk.Frame(self.tabs, padding=16)
        self.info_tab = ttk.Frame(self.tabs, padding=16)
        self.about_tab = ttk.Frame(self.tabs, padding=16)
        self.tabs.add(self.single_tab, text="Tekli Analiz")
        self.tabs.add(self.bulk_tab, text="Toplu İşlem")
        self.tabs.add(self.info_tab, text="Model Bilgisi")
        self.tabs.add(self.about_tab, text="Hakkında")
        self._build_single_tab()
        self._build_bulk_tab()
        self._build_info_tab()
        self._build_about_tab()
        ttk.Label(outer, text="Çevrimdışı analiz · Kod çalıştırılmaz · Çevrimiçi aktarım yalnızca sen başlatınca yapılır", style="Muted.TLabel").pack(anchor="w", pady=(10, 0))

    def _card(self, parent, padding=14):
        frame = ttk.Frame(parent, style="Panel.TFrame", padding=padding)
        return frame

    def _build_single_tab(self):
        controls = ttk.Frame(self.single_tab)
        controls.pack(fill=X, pady=(0, 10))
        ttk.Label(controls, text="Analiz türü").pack(side=LEFT)
        selector = ttk.Combobox(controls, textvariable=self.analysis_mode, state="readonly", width=35,
                                values=("Yazım hatalı ürün arama", "Yazılım hata çözümleme"))
        selector.pack(side=LEFT, padx=(10, 20))
        selector.bind("<<ComboboxSelected>>", lambda _event: self._switch_analysis_mode())
        ttk.Label(controls, text="Çevrimdışı model", style="Accent.TLabel").pack(side=RIGHT)

        self.product_panel = self._card(self.single_tab)
        self.product_panel.pack(fill=BOTH, expand=True)
        ttk.Label(self.product_panel, text="Ürün ara", style="PanelSection.TLabel").pack(anchor="w")
        ttk.Label(self.product_panel, text="Ürün adını yaz. Harf hataları, bitişik kelimeler ve eksik karakterler için öneri al; sonuçları farklı sıralama yöntemleriyle karşılaştır.", style="PanelSubtitle.TLabel", wraplength=740).pack(anchor="w", pady=(5, 16))
        search_row = ttk.Frame(self.product_panel, style="Panel.TFrame")
        search_row.pack(fill=X)
        self.query_entry = ttk.Entry(search_row)
        self.query_entry.pack(side=LEFT, fill=X, expand=True, padx=(0, 10))
        self.query_entry.bind("<Return>", lambda _event: self._run_product_search())
        ttk.Label(search_row, text="Sıralama", style="PanelMuted.TLabel").pack(side=LEFT, padx=(0, 6))
        ttk.Combobox(search_row, textvariable=self.active_search_method, state="readonly", width=22,
                     values=("Klasik tam eşleşme", "BM25", "Karakter TF-IDF", "Hibrit")).pack(side=LEFT, padx=(0, 10))
        self.search_button = ttk.Button(search_row, text="Ürün ara", style="Accent.TButton", command=self._run_product_search)
        self.search_button.pack(side=RIGHT)
        self.suggestion_var = StringVar(value="")
        self.suggestion_row = ttk.Frame(self.product_panel, style="Panel.TFrame")
        self.suggestion_row.pack(fill=X, pady=(10, 2))
        self.suggestion_button = ttk.Button(self.suggestion_row, text="", style="TButton", command=self._apply_suggestion)
        self.suggestion_button.pack_forget()
        ttk.Label(self.product_panel, text="Ürün eşleşmeleri", style="PanelSection.TLabel").pack(anchor="w", pady=(14, 8))
        results_frame = ttk.Frame(self.product_panel, style="Panel.TFrame")
        results_frame.pack(fill=BOTH, expand=True, pady=(8, 0))
        self.product_tree = ttk.Treeview(results_frame, columns=("rank", "title", "category", "score"), show="headings", height=12)
        self.product_tree.tag_configure("row-a", background=COLORS["input"])
        self.product_tree.tag_configure("row-b", background=COLORS["panel"])
        for col, title, width in (("rank", "#", 48), ("title", "Ürün adı", 590), ("category", "Kategori", 210), ("score", "Eşleşme", 105)):
            self.product_tree.heading(col, text=title)
            self.product_tree.column(col, width=width, minwidth=44 if col == "rank" else 90, stretch=col in ("title", "category"), anchor="w" if col == "title" else "center")
        scroll = ttk.Scrollbar(results_frame, orient="vertical", command=self.product_tree.yview)
        self.product_tree.configure(yscrollcommand=scroll.set)
        self.product_tree.pack(side=LEFT, fill=BOTH, expand=True)
        scroll.pack(side=RIGHT, fill=Y)
        self.search_status = StringVar(value="Arama yöntemi ürün başlığındaki yazım hatalarına tolerans gösterir.")
        ttk.Label(self.product_panel, textvariable=self.search_status, style="PanelMuted.TLabel", wraplength=740).pack(anchor="w", pady=(8, 0))

        self.error_panel = self._card(self.single_tab)
        # Hidden until the user selects the software-error analyzer.
        ttk.Label(self.error_panel, text="Yazılım hatasını incele", style="PanelSection.TLabel").pack(anchor="w")
        ttk.Label(self.error_panel, text="Hata mesajını ve ilgili kodu ekle. Kod çalıştırılmaz; çevrimdışı imza eşleştirmesi ve Python sözdizimi kontrolü yapılır.", style="PanelSubtitle.TLabel", wraplength=740).pack(anchor="w", pady=(5, 12))
        langrow = ttk.Frame(self.error_panel, style="Panel.TFrame")
        langrow.pack(fill=X, pady=(0, 8))
        ttk.Label(langrow, text="Dil", style="PanelMuted.TLabel").pack(side=LEFT)
        language_select = ttk.Combobox(langrow, textvariable=self.active_language, state="readonly", width=25,
                                       values=("Otomatik", "Python", "JavaScript/TypeScript", "C#", "Java", "PHP", "SQL", "C/C++", "Go", "Rust", "HTML/CSS"))
        language_select.pack(side=LEFT, padx=(8, 12))
        language_select.bind("<<ComboboxSelected>>", self._refresh_language_hint)
        ttk.Button(langrow, text="Hata/kod dosyası aç…", command=self._load_error_file).pack(side=LEFT)
        self.language_status = StringVar(value="Dil seçimini koddan otomatik yapar.")
        ttk.Label(langrow, textvariable=self.language_status, style="PanelAccent.TLabel").pack(side=RIGHT, padx=8)
        ttk.Label(self.error_panel, text="Hata mesajı veya traceback", style="PanelMuted.TLabel").pack(anchor="w")
        self.error_message = self._text_area(self.error_panel, height=5)
        self.error_message.pack(fill=X, pady=(5, 10))
        ttk.Label(self.error_panel, text="İlgili kod (isteğe bağlı)", style="PanelMuted.TLabel").pack(anchor="w")
        self.source_code = self._text_area(self.error_panel, height=8)
        self.source_code.pack(fill=X, pady=(5, 8))
        self.error_message.bind("<KeyRelease>", self._refresh_language_hint)
        self.source_code.bind("<KeyRelease>", self._refresh_language_hint)
        error_buttons = ttk.Frame(self.error_panel, style="Panel.TFrame")
        error_buttons.pack(fill=X, pady=(4, 10))
        self.error_button = ttk.Button(error_buttons, text="Çevrimdışı analiz et", style="Accent.TButton", command=self._run_error_analysis)
        self.error_button.pack(side=LEFT)
        ttk.Button(error_buttons, text="Çevrimiçi HaKING AI’da devam et…", command=self._handoff_to_online).pack(side=LEFT, padx=10)
        self.error_result = self._text_area(self.error_panel, height=10)
        self.error_result.configure(state="disabled")
        self.error_result.pack(fill=BOTH, expand=True)

    def _text_area(self, parent, height=6):
        import tkinter as tk
        widget = tk.Text(parent, height=height, wrap="word", undo=True, bg=COLORS["input"], fg=COLORS["text"],
                         insertbackground=COLORS["text"], selectbackground="#443873", relief="flat",
                         highlightthickness=1, highlightbackground=COLORS["line"], highlightcolor=COLORS["purple"],
                         padx=10, pady=9, font=("Cascadia Code", 10))
        return widget

    def _corrected_query(self, query: str, corrections: list[tuple[str, str]]) -> str:
        corrected = query
        for wrong, right in corrections:
            corrected = re.sub(rf"(?i)\b{re.escape(wrong)}\b", right, corrected)
        return corrected

    def _apply_suggestion(self):
        query = self._corrected_query(self.query_entry.get().strip(), getattr(self, "last_corrections", []))
        if query and query != self.query_entry.get().strip():
            self.query_entry.delete(0, END)
            self.query_entry.insert(0, query)
            self._run_product_search()

    def _refresh_language_hint(self, _event=None):
        language, confidence, method = _detect_language(
            self.source_code.get("1.0", "end-1c"), self.error_message.get("1.0", "end-1c"), self.active_language.get()
        )
        if language == "Belirlenemedi":
            self.language_status.set("Dil netleşmedi · hata imzasından analiz")
        else:
            self.language_status.set(f"Algılanan dil: {language} · {method.lower()}")

    def _switch_analysis_mode(self):
        if self.analysis_mode.get() == "Yazılım hata çözümleme":
            self.product_panel.pack_forget()
            self.error_panel.pack(fill=BOTH, expand=True)
        else:
            self.error_panel.pack_forget()
            self.product_panel.pack(fill=BOTH, expand=True)

    def _build_bulk_tab(self):
        card = self._card(self.bulk_tab)
        card.pack(fill=BOTH, expand=True)
        ttk.Label(card, text="Toplu analiz", style="PanelSection.TLabel").pack(anchor="w")
        ttk.Label(card, text="CSV dosyanı işle. Ürün aramada query sütunu; hata analizinde error_message, source_code ve language sütunları kullanılır. Ürün sorguları ilk 5 eşleşmeyi dışa aktarır; kod çalıştırılmaz.", style="PanelSubtitle.TLabel", wraplength=740).pack(anchor="w", pady=(6, 14))
        row = ttk.Frame(card, style="Panel.TFrame")
        row.pack(fill=X, pady=(0, 10))
        ttk.Label(row, text="İşlem", style="PanelMuted.TLabel").pack(side=LEFT)
        ttk.Combobox(row, textvariable=self.bulk_mode, state="readonly", width=28,
                     values=("Ürün sorguları", "Yazılım hata mesajları")).pack(side=LEFT, padx=10)
        self.bulk_path = StringVar(value="")
        ttk.Entry(card, textvariable=self.bulk_path, state="readonly").pack(fill=X, pady=(0, 10))
        file_row = ttk.Frame(card, style="Panel.TFrame")
        file_row.pack(fill=X)
        ttk.Button(file_row, text="CSV seç…", command=self._select_bulk_file).pack(side=LEFT)
        self.bulk_button = ttk.Button(file_row, text="Toplu işlemi başlat", style="Accent.TButton", command=self._run_bulk)
        self.bulk_button.pack(side=LEFT, padx=10)
        self.bulk_progress = ttk.Progressbar(card, mode="indeterminate")
        self.bulk_progress.pack(fill=X, pady=(16, 10))
        self.bulk_status = StringVar(value="Girdi ve sonuçlar bu cihazda işlenir ve kaydedilir.")
        ttk.Label(card, textvariable=self.bulk_status, style="PanelMuted.TLabel", wraplength=740).pack(anchor="w")
        ttk.Label(card, text="Çıktı, seçilen CSV dosyasının yanında *_sonuc.csv adıyla oluşturulur.", style="PanelMuted.TLabel").pack(anchor="w", pady=(12, 0))

    def _build_info_tab(self):
        wrap = ttk.Frame(self.info_tab)
        wrap.pack(fill=BOTH, expand=True)
        chart_card = self._card(wrap, padding=12)
        chart_card.pack(fill=X, pady=(0, 12))
        ttk.Label(chart_card, text="Yöntem karşılaştırması", style="PanelSection.TLabel").pack(anchor="w")
        ttk.Label(chart_card, text="Bağımsız test kümesi · Recall@10 ve MRR · 0–1 aralığı", style="PanelMuted.TLabel").pack(anchor="w", pady=(3, 5))
        self.metrics_chart = tk.Canvas(chart_card, height=176, background=COLORS["panel"], highlightthickness=0, borderwidth=0)
        self.metrics_chart.pack(fill=X, expand=True)
        self.metrics_chart.bind("<Configure>", lambda _event: self._draw_metrics_chart())
        self.chart_metrics = None
        content_frame = ttk.Frame(wrap, style="Panel.TFrame", padding=8)
        content_frame.pack(fill=BOTH, expand=True)
        content = self._text_area(content_frame, height=14)
        scrollbar = ttk.Scrollbar(content_frame, orient="vertical", command=content.yview)
        content.configure(yscrollcommand=scrollbar.set)
        content.pack(side=LEFT, fill=BOTH, expand=True)
        scrollbar.pack(side=RIGHT, fill=Y)
        content.insert("1.0", "Model bilgileri yükleniyor…")
        content.configure(state="disabled")
        self.metrics_text = content

    def _draw_metrics_chart(self):
        canvas = getattr(self, "metrics_chart", None)
        if canvas is None:
            return
        width = max(canvas.winfo_width(), 520)
        canvas.delete("all")
        canvas.configure(background=COLORS["panel"])
        metrics = self.chart_metrics
        if not metrics or not metrics.get("methods"):
            canvas.create_text(14, 24, anchor="w", fill=COLORS["muted"], text="Eğitim raporu bulunduğunda karşılaştırma burada görünür.")
            return
        methods = metrics["methods"]
        colors = (COLORS["purple"], COLORS["green"], COLORS["amber"], "#6fb5ff")
        label_width = 160
        right_padding = 68
        bar_width = max(width - label_width - right_padding, 240)
        canvas.create_text(label_width, 12, anchor="w", fill=COLORS["muted"], text="Recall@10")
        canvas.create_text(label_width + bar_width // 2, 12, anchor="w", fill=COLORS["muted"], text="MRR")
        for index, (method, result) in enumerate(methods.items()):
            y = 42 + index * 32
            color = colors[index % len(colors)]
            canvas.create_text(10, y + 4, anchor="w", fill=COLORS["text"], text=method)
            for metric_index, key in enumerate(("recall_at_10", "mrr")):
                value = max(0.0, min(1.0, float(result.get(key, 0))))
                x = label_width + metric_index * (bar_width // 2)
                segment_width = bar_width // 2 - 34
                canvas.create_rectangle(x, y - 5, x + segment_width, y + 11, fill=COLORS["panel2"], outline="")
                canvas.create_rectangle(x, y - 5, x + segment_width * value, y + 11, fill=color, outline="")
                canvas.create_text(x + segment_width + 7, y + 3, anchor="w", fill=COLORS["muted"], text=f"{value:.2f}")

    def _build_about_tab(self):
        card = self._card(self.about_tab, padding=20)
        card.pack(fill=BOTH, expand=True)
        ttk.Label(card, text="Yazım Hatalarını Anlayan Akıllı Ürün Arama Motoru", style="PanelSection.TLabel", wraplength=740).pack(anchor="w")
        ttk.Label(card, text="PriceRunner veri kümesi · Çevrimdışı ve ölçülebilir arama", style="PanelAccent.TLabel").pack(anchor="w", pady=(8, 16))
        copy = (
            "Bu masaüstü uygulama, PriceRunner ürün başlıklarında yazım hatalarına dayanıklı arama yapmak için BM25, karakter n-gram TF-IDF ve doğrulama kümesinde seçilmiş hibrit sıralamayı karşılaştırır. Klasik tüm-terimler eşleşmesi temel çizgidir.\n\n"
            "Ek HaKING AI özelliği, çeşitli yaygın programlama dili hata imzalarını çevrimdışı sınıflandırır; Python kodunda ast.parse ile sözdizimi/girinti denetimi yapabilir ve hata mesajındaki satır numarasının çevresini gösterir. Bu bir derleyici veya tüm hataları kesin çözen genel yapay zekâ değildir; sonuçlar olası teşhistir.\n\n"
            "Gizlilik: Uygulama varsayılan olarak ağa bağlanmaz. Girilen hata mesajı, kod ve ürün sorguları yerel cihazda kalır. Kod çalıştırılmaz. Çevrimiçi HaKING AI’ya aktarım düğmesine basıldığında içerik önce açık onayla panoya kopyalanır ve tarayıcı açılır; kullanıcı HaKING AI sohbetine kendisi yapıştırıp gönderir. API anahtarı/şifre gibi sırları paylaşma.\n\n"
            "Veri kaynağı: UCI Product Classification and Clustering (PriceRunner), CC BY 4.0. Veri ayrıntıları ve kaynak bağlantısı README ve data/KAYNAK.md içindedir."
        )
        ttk.Label(card, text=copy, wraplength=740, justify="left", style="PanelMuted.TLabel").pack(anchor="w", pady=(0, 18))
        ttk.Button(card, text="HaKING AI çevrimiçi sohbetini aç", command=self._open_online).pack(anchor="w")

    def _load_models(self):
        try:
            if not MODEL_PATH.is_file():
                raise FileNotFoundError("Ürün arama modeli yok. İlk kurulumda train.py çalıştırılmalı.")
            if not ERROR_MODEL_PATH.is_file():
                raise FileNotFoundError("Yazılım hata sınıflandırma modeli yok. İlk kurulumda train.py çalıştırılmalı.")
            model = HaKINGModel()
            error_model = joblib.load(ERROR_MODEL_PATH)
            self.load_queue.put(("ok", model, error_model))
        except Exception as exc:
            self.load_queue.put(("error", str(exc)))

    def _poll_model_load(self):
        try:
            state = self.load_queue.get_nowait()
        except queue.Empty:
            self.root.after(120, self._poll_model_load)
            return
        if state[0] == "ok":
            self.model, self.error_classifier = state[1], state[2]
            self.model_status.set("Çevrimdışı modeller hazır")
            self.search_button.configure(state="normal")
            self.error_button.configure(state="normal")
        else:
            self.model_status.set("Model dosyaları bulunamadı")
            messagebox.showerror("Model yüklenemedi", f"{state[1]}\n\nModelleri üretmek için README'deki train.py adımını çalıştır.")

    def _run_product_search(self):
        if not self.model:
            self.search_status.set("Model yüklemesi tamamlanmadı.")
            return
        query = self.query_entry.get().strip()
        if not query:
            self.search_status.set("Aranacak ürün adını yaz.")
            return
        for item in self.product_tree.get_children():
            self.product_tree.delete(item)
        bundle = self.model.bundle
        method = self.active_search_method.get()
        results, latency = top_results(bundle, query, method, 10)
        for index, item in enumerate(results, 1):
            self.product_tree.insert("", END, values=(index, item["title"], item["category"], item["score"]), tags=("row-a" if index % 2 else "row-b",))
        corrections = suggest_corrections(bundle, query)
        self.last_corrections = corrections
        if corrections:
            corrected_query = self._corrected_query(query, corrections)
            self.suggestion_button.configure(text=f"Bunu mu demek istedin?  {corrected_query}   ·   Düzeltilmiş sorguyla ara")
            self.suggestion_button.pack(anchor="w")
        else:
            self.suggestion_button.pack_forget()
        self.search_status.set(f"{len(results)} ürün kümesi · {method} sıralaması · {latency:.1f} ms · Yerel analiz · Eşleşme puanı olasılık değildir")
        if not results:
            self.search_status.set("Eşleşme bulunamadı. Daha kısa bir sorgu veya farklı sıralama seçeneği deneyebilirsin.")

    def _load_error_file(self):
        path = filedialog.askopenfilename(
            title="Metin/kod dosyası seç", filetypes=(("Metin ve kod", "*.txt *.log *.py *.js *.ts *.tsx *.jsx *.cs *.java *.php *.sql *.c *.cpp *.go *.rs *.html *.css"), ("Tüm dosyalar", "*.*")),
        )
        if not path:
            return
        try:
            file_path = Path(path)
            if file_path.stat().st_size > MAX_FILE_BYTES:
                raise ValueError("Dosya boyutu 64 KiB sınırını aşıyor. İlgili bölümü kopyalayabilirsin.")
            text = file_path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError, ValueError) as exc:
            messagebox.showerror("Dosya açılamadı", str(exc))
            return
        self.source_code.delete("1.0", END)
        self.source_code.insert("1.0", text[:MAX_FILE_BYTES])
        self._refresh_language_hint()

    def _run_error_analysis(self):
        if not self.error_classifier:
            messagebox.showinfo("Model hazır değil", "Çevrimdışı hata modeli yüklenemedi.")
            return
        message = self.error_message.get("1.0", END).strip()
        code = self.source_code.get("1.0", END).strip()
        result = analyze_error(message, code, self.active_language.get(), self.error_classifier)
        lines = [
            f"{result['title']}",
            f"Kategori: {result['category']} · Dil: {result['language']} · Dil tespiti: {result['language_method']} · Eşleşme güveni: {result['confidence']:.0%}",
            "", f"Olası neden\n{result['cause']}", "", f"Nasıl ilerlemeli\n{result['fix']}",
        ]
        if result["line"]:
            location = f"Satır {result['line']}" + (f", sütun {result['column']}" if result.get("column") else "")
            lines.extend(["", f"Konum: {location}"])
        if result["context"]:
            lines.extend(["", result["context"]])
        if result["official_url"]:
            lines.extend(["", f"Resmî belge: {result['official_url']}"])
        if not result["recognized"]:
            lines.extend(["", "Not: Bu mesaj bilinen imzalardan eşleşmedi. Öneri kesin teşhis değildir."])
        self.error_result.configure(state="normal")
        self.error_result.delete("1.0", END)
        self.error_result.insert("1.0", "\n".join(lines))
        self.error_result.configure(state="disabled")

    def _handoff_to_online(self):
        message = self.error_message.get("1.0", END).strip()
        code = self.source_code.get("1.0", END).strip()
        if not message and not code:
            messagebox.showinfo("İçerik gerekli", "Önce hata mesajını veya kodu ekle.")
            return
        prompt = (
            "Bu yazılım hatasını Türkçe analiz et. Önce hata mesajındaki kesin bulguları, sonra olası kök nedeni ve ilgili satırdaki düzeltmeyi açıkla. "
            "Varsayım yaparsan belirt; kodu yeniden yazman gerekiyorsa yalnızca etkilenen kısmı ver.\n\n"
            f"Dil: {self.active_language.get()}\nHata mesajı:\n{message or '(eklenmedi)'}\n\nİlgili kod:\n{code or '(eklenmedi)'}"
        )
        if not messagebox.askyesno("Çevrimiçi aktarımı onayla", "Hata mesajı ve kod panoya kopyalanacak, HaKING AI açılacak. Gönderme işlemini sen sohbet ekranında yaparsın. İçeriğinde parola/API anahtarı varsa önce kaldır. Devam edilsin mi?"):
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(prompt)
        self.root.update()
        webbrowser.open(ONLINE_URL)
        messagebox.showinfo("Metin hazır", "İstek panoya kopyalandı. HaKING AI sohbetine yapıştırıp içeriği gözden geçirdikten sonra kendin gönder.")

    def _open_online(self):
        webbrowser.open(ONLINE_URL)

    def _select_bulk_file(self):
        path = filedialog.askopenfilename(title="CSV dosyası seç", filetypes=(("CSV dosyaları", "*.csv"),))
        if path:
            self.bulk_path.set(path)
            try:
                columns = list(pd.read_csv(path, nrows=0).columns)
                if self.bulk_mode.get() == "Ürün sorguları":
                    valid = "query" in columns
                    expected = "query"
                else:
                    valid = any(col in columns for col in ("error_message", "error", "message", "hata", "hata_mesaji")) or len(columns) == 1
                    expected = "error_message (veya tek sütun)"
                status = "Gerekli sütun bulundu" if valid else f"Gerekli sütun eksik: {expected}"
                self.bulk_status.set(f"{Path(path).name} · {len(columns)} sütun · {', '.join(columns[:8])} · {status}")
            except Exception as exc:
                self.bulk_status.set(f"CSV başlığı okunamadı: {exc}")

    def _run_bulk(self):
        if not self.model:
            messagebox.showinfo("Model hazır değil", "Modeller yüklenmeden toplu işlem başlatılamaz.")
            return
        path = Path(self.bulk_path.get())
        if not path.is_file():
            messagebox.showinfo("CSV gerekli", "Önce bir CSV dosyası seç.")
            return
        mode = self.bulk_mode.get()
        self.bulk_button.configure(state="disabled")
        self.bulk_progress.start(12)
        self.bulk_status.set("CSV yerel olarak işleniyor…")
        threading.Thread(target=self._bulk_worker, args=(path, mode), daemon=True).start()
        self.root.after(150, self._poll_bulk)

    def _bulk_worker(self, path: Path, mode: str):
        try:
            if path.stat().st_size > 20 * 1024 * 1024:
                raise ValueError("CSV 20 MiB sınırını aşıyor.")
            frame = pd.read_csv(path, dtype=str, keep_default_na=False)
            if len(frame) > 5_000:
                raise ValueError("Tek toplu işlemde en fazla 5.000 satır desteklenir.")
            if mode == "Ürün sorguları":
                output = self.model.predict(frame)
                if "rank" in output.columns:
                    output = output[output["rank"].isna() | (output["rank"] <= 5)].reset_index(drop=True)
            else:
                error_col = next((col for col in ("error_message", "error", "message", "hata", "hata_mesaji") if col in frame.columns), None)
                if not error_col:
                    if len(frame.columns) == 1:
                        error_col = frame.columns[0]
                    else:
                        raise ValueError("Hata CSV'sinde error_message sütunu bulunmalı (tek sütunlu CSV de kabul edilir).")
                source_col = next((col for col in ("source_code", "code", "kod") if col in frame.columns), None)
                language_col = next((col for col in ("language", "dil") if col in frame.columns), None)
                records = []
                for _, row in frame.iterrows():
                    result = analyze_error(str(row[error_col]), str(row[source_col]) if source_col else "",
                                           str(row[language_col]) if language_col else "Otomatik", self.error_classifier)
                    records.append({key: result[key] for key in ("recognized", "title", "category", "confidence", "line", "cause", "fix")})
                output = pd.concat([frame.reset_index(drop=True), pd.DataFrame(records)], axis=1)
            output_path = path.with_name(f"{path.stem}_sonuc.csv")
            output.to_csv(output_path, index=False, encoding="utf-8-sig")
            self.batch_queue.put(("ok", len(frame), output_path))
        except Exception as exc:
            self.batch_queue.put(("error", str(exc)))

    def _poll_bulk(self):
        try:
            result = self.batch_queue.get_nowait()
        except queue.Empty:
            self.root.after(200, self._poll_bulk)
            return
        self.bulk_progress.stop()
        self.bulk_button.configure(state="normal")
        if result[0] == "ok":
            self.bulk_status.set(f"Tamamlandı · {result[1]} satır · {result[2]}")
            messagebox.showinfo("Toplu işlem tamamlandı", f"Sonuç dosyası kaydedildi:\n{result[2]}")
        else:
            self.bulk_status.set("İşlem tamamlanamadı.")
            messagebox.showerror("CSV işlenemedi", result[1])

    def _poll_model_load_info(self):
        """Update model tab once metrics are loaded, with safe fallback copy."""
        if not METRICS_PATH.is_file():
            text = "Model ölçümleri bulunamadı. README'deki train.py komutuyla modelleri ve metrikleri üret."
            self.chart_metrics = None
        else:
            try:
                metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
                self.chart_metrics = metrics
                lines = [
                    f"UYGULAMA SÜRÜMÜ  {APP_VERSION}",
                    f"EĞİTİM ZAMANI    {metrics.get('trained_at_utc', '—')}",
                    "",
                    "ÜRÜN ARAMA", f"PriceRunner kayıtları: {metrics['dataset']['rows']:,}",
                    f"Ürün kümeleri: {metrics['dataset']['clusters']:,} · Kategori: {metrics['dataset']['categories']}",
                    f"Sorgu deneyleri: {metrics['query_experiment']['total']} (validation {metrics['query_experiment']['validation']}, bağımsız test {metrics['query_experiment']['test']})",
                    f"Hibrit BM25 ağırlığı: {metrics['selected_bm25_weight']:.1f}", "",
                ]
                for method, result in metrics["methods"].items():
                    lines.append(f"{method}: Recall@5 {result['recall_at_5']:.3f} · Recall@10 {result['recall_at_10']:.3f} · MRR {result['mrr']:.3f} · ort. {result['mean_latency_ms']:.1f} ms")
                lines.extend(["", "HİBRİT YÖNTEM · HATA TÜRÜNE GÖRE TEST"])
                for row in metrics["methods"]["Hibrit"]["per_error_type"]:
                    lines.append(f"{row['error_type']}: Recall@5 {row['recall_at_5']:.3f} · Recall@10 {row['recall_at_10']:.3f} · MRR {row['mrr']:.3f} · ort. {row['mean_latency_ms']:.1f} ms · n={row['count']}")
                lines.extend(["", "YAZILIM HATA SINIFLANDIRICI", f"Sentetik doğrulama doğruluğu: {metrics['error_classifier']['validation_accuracy']:.3f}",
                              f"Kategori sayısı: {len(metrics['error_classifier']['categories'])}", metrics['error_classifier']['evaluation_note'],
                              "", "ÖNEMLİ SINIR", metrics["limits"]])
                text = "\n".join(lines)
            except Exception as exc:
                self.chart_metrics = None
                text = f"Metrik dosyası okunamadı: {exc}"
        self._draw_metrics_chart()
        self.metrics_text.configure(state="normal")
        self.metrics_text.delete("1.0", END)
        self.metrics_text.insert("1.0", text)
        self.metrics_text.configure(state="disabled")

    def run(self):
        self._poll_model_load_info()
        self.root.mainloop()

