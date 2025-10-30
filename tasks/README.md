# Veziv Tasks Microservice

## 📋 Descriere Generală

Microserviciul **Veziv Tasks** este o componentă esențială a sistemului Giurom, dedicată gestionării complete a task-urilor și sarcinilor în cadrul organizației. Acesta oferă o arhitectură modulară și scalabilă pentru crearea, atribuirea și executarea task-urilor personalizabile.

## 🏗️ Arhitectura Sistemului

### Structura Modulare

Microserviciul este organizat în **3 module principale**, fiecare cu responsabilități specifice:

```
src/
├── template/          # Gestionarea șabloanelor de task-uri
├── assignment/        # Atribuirea task-urilor către angajați
├── execution/         # Executarea și completarea task-urilor
└── common/           # Componente comune (interceptori, validatori)
```

### Tehnologii Utilizate

- **Framework**: NestJS 10.0.0
- **Database**: MariaDB/MySQL cu TypeORM
- **Documentație API**: Swagger/OpenAPI
- **Validare**: class-validator
- **HTTP Client**: @nestjs/axios
- **WebSockets**: Socket.io (pentru comunicare în timp real)

## 🎯 Module și Funcționalități

### 1. Template Module (`/template`)

**Scop**: Gestionarea șabloanelor reutilizabile pentru task-uri

#### Entități:
- **TaskTemplate**: Șabloane de task-uri cu tipuri (EMPLOYEE/MANAGER)
- **TaskElement**: Elemente dinamice din șabloane

#### Tipuri de Elemente Suportate:
```typescript
enum ElementType {
  INPUT, TEXTAREA, CHECKBOX, RADIO, SELECT, DATE,
  LABEL, NUMBER, TASK_NAME, RESPONSIBLE, PERSON,
  GROUP, WORK_LOCATION, ESTIMATED_DURATION,
  VISIBLE_FROM, RECURRENCE, SCORING_BOOLEAN,
  ALLOW_POSTPONE, PHOTO
}
```

#### Endpoints:
- `POST /api/templates` - Creează template nou
- `GET /api/templates` - Lista toate template-urile
- `GET /api/templates/:id` - Template specific
- `PATCH /api/templates/:id` - Actualizează template
- `DELETE /api/templates/:id` - Șterge template

### 2. Assignment Module (`/assignment`)

**Scop**: Atribuirea task-urilor către angajați sau grupuri

#### Entități:
- **TaskAssignment**: Atribuirea unui task specific
- **TaskAssignmentElement**: Elemente personalizate pentru atribuire

#### Statusuri de Atribuire:
```typescript
enum AssignmentStatus {
  ASSIGNED,      // Atribuit
  IN_PROGRESS,   // În progres
  COMPLETED,     // Completat
  OVERDUE        // Întârziat
}
```

#### Priorități:
```typescript
enum Priority {
  LOW, MEDIUM, HIGH
}
```

#### Endpoints:
- `POST /api/assignments` - Creează atribuire nouă
- `GET /api/assignments` - Lista atribuirilor
- `GET /api/assignments/:id` - Atribuire specifică
- `PATCH /api/assignments/:id` - Actualizează atribuirea
- `DELETE /api/assignments/:id` - Șterge atribuirea

### 3. Execution Module (`/execution`)

**Scop**: Executarea și completarea task-urilor atribuite

#### Entități:
- **TaskExecution**: Execuția unui task
- **TaskExecutionAnswer**: Răspunsurile la elementele task-ului

#### Funcționalități:
- Completarea task-urilor cu răspunsuri
- Sistem de scoring automat
- Verificare manager (opțional)
- Comentarii și feedback

#### Endpoints:
- `POST /api/executions` - Creează execuție nouă
- `GET /api/executions` - Lista execuțiilor
- `GET /api/executions/:id` - Execuție specifică
- `PATCH /api/executions/:id` - Actualizează execuția
- `POST /api/executions/:id/complete` - Completează execuția
- `POST /api/executions/:id/verify` - Verifică execuția (manager)

## 🔧 Configurare și Instalare

### Cerințe Preliminare
- Node.js 18+
- MariaDB/MySQL
- npm sau yarn

### Variabile de Mediu
Creează un fișier `.env` în directorul rădăcină:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=giurom_db

# Server
PORT=3008

# Alte configurări
NODE_ENV=development
```

### Instalare și Rulare

```bash

# Instalare dependențe
npm install

# Dezvoltare
npm run start:dev

# Producție
npm run build
npm run start:prod

# Testare
npm run test
npm run test:e2e
```

## 📊 Structura Bazei de Date

### Tabele Principale:

1. **Task_Templates** - Șabloane de task-uri
2. **Task_Elements** - Elemente din șabloane
3. **Task_Assignment** - Atribuiri de task-uri
4. **Task_Assignment_Element** - Elemente personalizate pentru atribuiri
5. **Task_Execution** - Execuții de task-uri
6. **Task_Execution_Answer** - Răspunsuri la execuții

### Relații:
- Template → Elements (One-to-Many)
- Template → Assignments (One-to-Many)
- Assignment → Assignment Elements (One-to-Many)
- Assignment → Executions (One-to-Many)
- Execution → Execution Answers (One-to-Many)

## 🔍 Validatori și Interceptori

### Validatori Personalizați:
- **TemplateExistsValidator**: Verifică existența template-ului
- **ElementsExistInTemplateValidator**: Validează elementele în template
- **AllElementsCompletedValidator**: Verifică completarea tuturor elementelor

### Response Interceptor:
Standardizează răspunsurile API în formatul:
```json
{
  "statusCode": 200,
  "data": {...},
  "message": "Succes"
}
```

## 📚 Documentație API

### Swagger UI
Accesează documentația interactivă la: `http://localhost:3008/docs`

### Endpoints Principali:

#### Templates
```
POST   /api/templates     - Creează template
GET    /api/templates     - Lista template-uri
GET    /api/templates/:id - Template specific
PATCH  /api/templates/:id - Actualizează template
DELETE /api/templates/:id - Șterge template
```

#### Assignments
```
POST   /api/assignments     - Creează atribuire
GET    /api/assignments     - Lista atribuiri
GET    /api/assignments/:id - Atribuire specifică
PATCH  /api/assignments/:id - Actualizează atribuirea
DELETE /api/assignments/:id - Șterge atribuirea
```

#### Executions
```
POST   /api/executions     - Creează execuție
GET    /api/executions     - Lista execuții
GET    /api/executions/:id - Execuție specifică
PATCH  /api/executions/:id - Actualizează execuția
POST   /api/executions/:id/complete - Completează execuția
POST   /api/executions/:id/verify   - Verifică execuția
```

## 🔄 Flux de Lucru

### 1. Crearea unui Task
1. **Creează Template** - Definește structura task-ului
2. **Adaugă Elemente** - Specifică câmpurile necesare
3. **Atribuie Task** - Asignează către angajat/grup
4. **Execută Task** - Angajatul completează task-ul
5. **Verifică** - Managerul verifică (opțional)

### 2. Tipuri de Task-uri
- **Task-uri Simple**: Input, checkbox, select
- **Task-uri Complexe**: Cu scoring, verificare manager
- **Task-uri Recurring**: Cu programare automată
- **Task-uri cu Foto**: Necesită capturi de imagine

## 🚀 Caracteristici Avansate

### Sistem de Scoring
- Scoring automat bazat pe răspunsuri
- Configurare flexibilă per element
- Calculare scor total

### Verificare Manager
- Opțiune de verificare obligatorie
- Comentarii și feedback
- Istoric verificări

### Flexibilitate Elemente
- 20+ tipuri de elemente
- Validare personalizabilă
- Ordine sortabilă
- Opțiuni de scoring

### CORS și Securitate
- CORS configurat pentru dezvoltare
- Validare strictă a datelor
- Interceptori pentru standardizare

## 🧪 Testare

```bash

# Teste unitare
npm run test

# Teste cu coverage
npm run test:cov

# Teste end-to-end
npm run test:e2e

# Teste în mod watch
npm run test:watch
```

## 📝 Logs și Debugging

### Logs de Pornire
```
Veziv Tasks Service rulează pe portul 3008
```

### Debug Mode
```bash
npm run start:debug
```

## 🔗 Integrare cu Alte Microservicii

Microserviciul este pregătit pentru integrare cu:
- **Veziv Company** - Pentru informații despre companii
- **Frontend Giurom** - Pentru interfața utilizator
- **Sisteme externe** - Prin API-uri REST

## 📞 Suport și Contribuții

Pentru întrebări sau probleme:
1. Verifică documentația Swagger
2. Consulte logurile aplicației
3. Testează endpoint-urile individual

---

**Versiune**: 0.0.1  
**Ultima actualizare**: 2024  
**Autor**: Echipa Veziv
