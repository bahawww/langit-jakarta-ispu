FROM python:3.12-slim

# libgomp1: runtime OpenMP untuk LightGBM / scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app

WORKDIR /app
COPY backend/requirements.lock ./
# shortcut: dependency tes ikut terpasang di image produksi agar pytest bisa jalan di container;
# pisahkan ke stage build terpisah jika ukuran image jadi masalah.
RUN pip install --no-cache-dir -r requirements.lock

COPY backend/ ./
RUN chmod +x entrypoint.sh
USER app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
