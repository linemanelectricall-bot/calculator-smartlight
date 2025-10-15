import os, json, math, io, datetime
from flask import Flask, render_template, request, send_file, jsonify, url_for, redirect, flash
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

app = Flask(__name__)
app.secret_key = "ganti_dengan_rahasia_anda"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_json(fname):
    p = os.path.join(DATA_DIR, fname)
    if not os.path.exists(p):
        raise FileNotFoundError(f"Data file missing: {p}")
    with open(p, encoding="utf-8") as f:
        return json.load(f)

# Load data files (sesuaikan nama file JSON-mu)
LAMPS = load_json("lamps.json")
ROOMS = load_json("rooms.json")

# Normalize keys if needed (supporting both earlier formats)
def normalize_rooms(raw):
    out = []
    for r in raw:
        # Accept keys: key,name,kategori,lux  OR key,ruangan,kategori,tingkat_pencahayaan_lux
        key = r.get("key") or r.get("key_room") or r.get("id") or (r.get("name","").lower().replace(" ","_"))
        name = r.get("name") or r.get("ruangan") or r.get("ruang") or r.get("nama") or ""
        kategori = r.get("kategori") or r.get("category") or "Umum"
        lux = r.get("lux") or r.get("tingkat_pencahayaan_lux") or r.get("lux_level") or 0
        out.append({"key": key, "name": name, "kategori": kategori, "lux": lux})
    return out

def normalize_lamps(raw):
    out = []
    for i, l in enumerate(raw):
        # Accept keys: name/watt/lumen OR brand/model/watt/lumen
        name = l.get("name") or (f"{l.get('brand','') } {l.get('model','')}".strip()) or l.get("model") or f"Lampu {i}"
        watt = l.get("watt") or l.get("W") or 0
        lumen = l.get("lumen") or l.get("lm") or 0
        out.append({"index": i, "name": name, "watt": watt, "lumen": lumen})
    return out

ROOMS = normalize_rooms(ROOMS)
LAMPS = normalize_lamps(LAMPS)

CATEGORIES = sorted(list({r["kategori"] for r in ROOMS}))

# PDF generator (simple)
def generate_pdf_mode1(summary):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    margin = 36
    y = h - margin
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, "Laporan Perhitungan Pencahayaan - Mode 1")
    y -= 22
    c.setFont("Helvetica", 10)
    for k, v in summary.items():
        c.drawString(margin, y, f"{k}: {v}")
        y -= 14
    c.showPage()
    c.save()
    buf.seek(0)
    return buf

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html",
        categories=CATEGORIES,
        rooms=ROOMS,
        lamps=LAMPS
    )

# optional API for ajax (if needed)
@app.route("/api/rooms")
def api_rooms():
    kat = request.args.get("kategori")
    out = [r for r in ROOMS if r["kategori"] == kat] if kat else ROOMS
    return jsonify(out)

# sample download pdf endpoint (mode1)
@app.route("/download_pdf_mode1", methods=["POST"])
def download_pdf_mode1():
    try:
        data = request.json or request.form.to_dict()
        # build human-friendly summary lines
        summary = {}
        summary['Tanggal'] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        for k in ("room","area","E","eta","lamp_name","lamp_watt","lamp_lumen","n_lamps","total_watt"):
            if k in data:
                summary[k] = str(data[k])
        buf = generate_pdf_mode1(summary)
        filename = f"laporan_mode1_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
        return send_file(buf, as_attachment=True, download_name=filename, mimetype="application/pdf")
    except Exception as e:
        return ("Error: "+str(e)), 500


if __name__ == "__main__":
    app.run(debug=True, port=8080)
    # host=0.0.0.0 supaya bisa diakses dari luar (hosting / LAN)
    app.run(host="0.0.0.0", port=5000,debug=False)

