@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python 3.11, 3.12 veya 3.13 bulunamadi. Python'u python.org adresinden kurup tekrar deneyin.
  pause
  exit /b 1
)
set "PY_TAG=3.13"
py -3.13 -V >nul 2>nul
if errorlevel 1 (
  set "PY_TAG=3.12"
  py -3.12 -V >nul 2>nul
  if errorlevel 1 (
    set "PY_TAG=3.11"
    py -3.11 -V >nul 2>nul
    if errorlevel 1 (
      echo Python 3.11, 3.12 veya 3.13 bulunamadi. Python'u python.org adresinden kurup tekrar deneyin.
      pause
      exit /b 1
    )
  )
)
if not exist ".venv\Scripts\python.exe" (
  echo Ilk kullanim: yerel Python ortami olusturuluyor...
  py -%PY_TAG% -m venv .venv
  if errorlevel 1 goto :failed
)
if not exist ".venv\.haking-dependencies-ready" (
  echo Gerekli kutuphaneler bir kez kuruluyor. Ilk kurulum internet gerektirir.
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 goto :failed
  type nul > .venv\.haking-dependencies-ready
)
.venv\Scripts\python.exe main.py
if errorlevel 1 goto :failed
exit /b 0
:failed
echo Uygulama baslatilamadi. README dosyasindaki kurulum ve sorun giderme bolumunu inceleyin.
pause
exit /b 1
