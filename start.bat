@echo off
echo Starting Law Firm Website...
echo.
echo Installing dependencies...
call npm install
echo.
echo Starting server...
echo Website will be available at: http://localhost:3000
echo.
call npm start
pause
