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
  ALLOW_POSTPONE, PHOTO, FINISH_AT
}
```

**Elemente Speciale:**
- **`SCORING_BOOLEAN`**: Checkbox-uri cu punctaj configurat prin `scoring_options`
- **`FINISH_AT`**: Deadline pentru finalizarea task-ului (datetime)
- **`PHOTO`**: Necesită capturi de imagine
- **`ALLOW_POSTPONE`**: Permite amânarea task-ului

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
- **Sistem de punctaj automat și inteligent**:
  - **Task finalizat în timp + toate checkbox-urile cu puncte bifate** → adaugă punctele normale
  - **Task finalizat în timp + checkbox-uri cu puncte nebifate** → scade punctele din toate opțiunile posibile
  - **Task finalizat după `finish_at`** → scade punctele din toate opțiunile posibile
  - **Task nefinalizat la sfârșitul zilei** → scade automat punctele prin endpoint-ul `process-overdue-tasks`
- **Elemente cu Deadline (`finish_at`)**:
  - Permite setarea unei date și ore specifice pentru finalizarea task-ului
  - Comparație automată între timpul de finalizare și deadline
  - Penalizare automată pentru întârzieri
- **Integrare cu punctajul zilnic**:
  - Actualizare automată în `Employee_Daily_Points`
  - Înregistrare în `Employee_Daily_Task_Points`
  - Calculare automată a punctajului total zilnic
- Verificare manager (opțional)
- Comentarii și feedback

#### Endpoints:
- `POST /api/executions` - Creează execuție nouă
- `GET /api/executions` - Lista execuțiilor
- `GET /api/executions/:id` - Execuție specifică
- `PATCH /api/executions/:id` - Actualizează execuția
- `POST /api/executions/:id/complete` - Completează execuția
- `POST /api/executions/:id/verify` - Verifică execuția (manager)

#### Endpoints Punctaj Zilnic:
- `POST /api/executions/daily-points` - Creează punctaj zilnic
- `GET /api/executions/daily-points/:employeeId/:workDate` - Punctaj zilnic specific
- `POST /api/executions/daily-task-points` - Adaugă punctaj pentru task
- `GET /api/executions/employee-points/:employeeId` - Punctaj pentru perioadă
- `GET /api/executions/employee-total-points/:employeeId` - Punctaj total pentru perioadă

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
2. **Task_Elements** - Elemente din șabloane (inclusiv `finish_at` pentru deadline)
3. **Task_Assignment** - Atribuiri de task-uri
4. **Task_Assignment_Element** - Elemente personalizate pentru atribuiri (inclusiv `value` pentru deadline)
5. **Task_Execution** - Execuții de task-uri
6. **Task_Execution_Answer** - Răspunsuri la execuții
7. **Employee_Daily_Points** - Punctaj zilnic al angajaților
8. **Employee_Daily_Task_Points** - Punctaj specific al task-urilor în cadrul zilei

### Câmpuri Speciale:
- **`Task_Elements.finish_at`**: Deadline pentru elemente de tip `FINISH_AT`
- **`Task_Assignment_Element.value`**: Valoare personalizată pentru deadline (pentru elemente `FINISH_AT`)
- **`Task_Execution.completed_at`**: Timpul real de finalizare pentru comparație cu deadline

### Relații:
- Template → Elements (One-to-Many)
- Template → Assignments (One-to-Many)
- Assignment → Assignment Elements (One-to-Many)
- Assignment → Executions (One-to-Many)
- Execution → Execution Answers (One-to-Many)
- Employee Daily Points → Daily Task Points (One-to-Many)
- Execution → Daily Task Points (One-to-Many)

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

#### Punctaj Zilnic
```
POST   /api/executions/daily-points           - Creează punctaj zilnic
GET    /api/executions/daily-points/:empId/:date - Punctaj zilnic specific
POST   /api/executions/daily-task-points      - Adaugă punctaj pentru task
GET    /api/executions/employee-points/:empId - Punctaj pentru perioadă
GET    /api/executions/employee-total-points/:empId - Punctaj total
POST   /api/executions/process-overdue-tasks  - Procesează task-uri întârziate
```

## 🔄 Flux de Lucru

### 1. Crearea unui Task cu Deadline
1. **Creează Template** - Definește structura task-ului
2. **Adaugă Elemente** - Specifică câmpurile necesare (inclusiv `FINISH_AT` pentru deadline)
3. **Atribuie Task** - Asignează către angajat/grup cu deadline personalizat
4. **Execută Task** - Angajatul completează task-ul înainte de deadline
5. **Verifică** - Managerul verifică (opțional)
6. **Calculare Punctaj** - Sistemul calculează automat punctajul bazat pe:
   - Timpul de finalizare vs deadline
   - Completarea elementelor cu puncte
   - Actualizează punctajul zilnic

### 2. Logica de Punctaj în Timp Real
- **La finalizarea task-ului**: Calculare automată și actualizare punctaj zilnic
- **La sfârșitul zilei**: Procesare task-uri nefinalizate prin `process-overdue-tasks`
- **Raportare**: Acces la punctaj pentru perioade specifice

### 2. Tipuri de Task-uri
- **Task-uri Simple**: Input, checkbox, select
- **Task-uri Complexe**: Cu scoring, verificare manager
- **Task-uri Recurring**: Cu programare automată
- **Task-uri cu Foto**: Necesită capturi de imagine
- **Task-uri cu Punctaj**: Contribuie la punctajul zilnic al angajatului
- **Task-uri cu Deadline**: Cu data și ora de finalizare specificată (`finish_at`)
- **Task-uri cu Penalizare**: Scădere automată de puncte pentru necompletare sau întârziere

## 🚀 Caracteristici Avansate

### Sistem de Scoring și Punctaj
- Scoring automat bazat pe răspunsuri
- Configurare flexibilă per element
- Calculare scor total
- **Punctaj zilnic al angajaților**
- **Punctaj specific per task**
- **Calculare automată a punctajului total zilnic**
- **Raportare punctaj pentru perioade specifice**

### Logica de Punctaj Inteligentă
1. **Task finalizat în timp + toate checkbox-urile cu puncte bifate**:
   - ✅ Adaugă punctele normale din răspunsuri
   - ✅ Contribuie pozitiv la punctajul zilnic

2. **Task finalizat în timp + checkbox-uri cu puncte nebifate**:
   - ❌ Scade punctele din toate opțiunile posibile
   - ⚠️ Penalizare pentru necompletarea elementelor obligatorii

3. **Task finalizat după deadline (`finish_at`)**:
   - ❌ Scade punctele din toate opțiunile posibile
   - ⏰ Penalizare pentru întârziere

4. **Task nefinalizat la sfârșitul zilei**:
   - ❌ Scade automat punctele prin `process-overdue-tasks`
   - 📅 Penalizare pentru nefinalizare

### Debug și Monitorizare
- Logs detaliate pentru debugging punctaj
- Afișare deadline vs timp finalizare
- Numărătoare elemente cu puncte vs completate
- Alertă pentru elemente necompletate

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
