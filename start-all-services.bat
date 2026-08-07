@echo off
echo Starting all microservices...

echo.
echo Starting API Gateway...
start "API Gateway" cmd /k "cd /d %~dp0 && npm run start:gateway"

timeout /t 2 /nobreak >nul

echo.
echo Starting Employees Microservice...
start "Employees MS" cmd /k "cd /d %~dp0 && npm run start:ms:employees"

timeout /t 2 /nobreak >nul

echo.
echo Starting Calendar Microservice...
start "Calendar MS" cmd /k "cd /d %~dp0 && npm run start:ms:calendar"

timeout /t 2 /nobreak >nul

echo.
echo Starting Notifications Microservice...
start "Notifications MS" cmd /k "cd /d %~dp0 && npm run start:ms:notifications"

timeout /t 2 /nobreak >nul

echo.
echo Starting Attendance Microservice...
start "Attendance MS" cmd /k "cd /d %~dp0 && npm run start:ms:attendance"

timeout /t 2 /nobreak >nul

echo.
echo Starting Requests Microservice...
start "Requests MS" cmd /k "cd /d %~dp0 && npm run start:ms:requests"

timeout /t 2 /nobreak >nul

echo.
echo Starting Suppliers Microservice...
start "Suppliers MS" cmd /k "cd /d %~dp0 && npm run start:ms:suppliers"

timeout /t 2 /nobreak >nul

echo.
echo Starting Waste Records Microservice...
start "Waste Records MS" cmd /k "cd /d %~dp0 && npm run start:ms:waste"

timeout /t 2 /nobreak >nul

echo.
echo Starting Stock Microservice...
start "Stock MS" cmd /k "cd /d %~dp0 && npm run start:ms:stock"

timeout /t 2 /nobreak >nul

echo.
echo Starting Recipes Microservice...
start "Recipes MS" cmd /k "cd /d %~dp0 && npm run start:ms:recipes"

timeout /t 2 /nobreak >nul

echo.
echo Starting Auth Microservice...
start "Auth MS" cmd /k "cd /d %~dp0auth && npm run start:dev"

timeout /t 2 /nobreak >nul

echo.
echo Starting Locations Microservice...
start "Locations MS" cmd /k "cd /d %~dp0 && npm run start:ms:locations"

timeout /t 2 /nobreak >nul

echo.
echo Starting Company Microservice...
start "Company MS" cmd /k "cd /d %~dp0 && npm run start:ms:company"

echo.
echo All microservices are starting...
echo Check each window for startup status.
echo API Gateway will be available at: http://localhost:3002
echo Required for Pontaj/Concedii: Requests MS on :3013
echo Required for Stoc: Stock MS on :3006
echo Required for Retetar: Recipes MS on :3005
echo.
pause