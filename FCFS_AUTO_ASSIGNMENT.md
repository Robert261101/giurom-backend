# Funcționalitatea de Atribuire Automată FCFS (First Come First Served)

## Descriere

Această funcționalitate implementează logica de atribuire automată pentru task-urile cu modul "primul venit, primul servit" (FCFS). Sistemul monitorizează task-urile care nu au fost preluate de angajați și le atribuie automat sau le șterge conform unor reguli specifice.

## Arhitectură Simplificată

### Task-uri FCFS
- **Creare**: Se creează **UN SINGUR** task cu `assigned_to_id = NULL` pentru întreg departamentul
- **Vizibilitate**: Task-ul este vizibil pentru **toți** angajații din departament
- **Acceptare**: Primul angajat care acceptă devine proprietar (`assigned_to_id = employee_id`)
- **Curățare**: Task-urile neacceptate se șterg automat la 00:00 sau când nu îndeplinesc condițiile

## Cum Funcționează

### 1. Monitorizare Automată
- **Cron Job**: Rulează la fiecare minut (`@Cron('0 * * * * *')`)
- **Filtrare**: Identifică task-urile FCFS cu status `ASSIGNED` și `assigned_to_id = NULL`
- **Procesare**: Aplică logica de decizie pentru fiecare task

### 2. Logica de Decizie

#### Condiții de Bază
- Task-ul trebuie să aibă `assignment_mode = 'first_come_first_served'`
- Task-ul trebuie să aibă `department_group_id` (task de grup)
- Task-ul trebuie să fie în status `ASSIGNED`
- Task-ul trebuie să aibă `assigned_to_id = NULL` (neacceptat încă)

#### Reguli de Atribuire și Ștergere

**1. Timpul de Așteptare**
- Dacă au trecut mai puțin de 2 ore de la atribuire → **Așteaptă**
- Dacă au trecut 2 ore sau mai mult → **Procesează**

**2. Logica Bazată pe `finalized_in` / `finalized_la` / `finish_at`**

**Fără deadline (`finalized_in`, `finalized_la`, `finish_at`):**
- **Mai mult de 4 ore până la 00:00** → **Atribuie random** după 2 ore
- **Mai puțin de 4 ore până la 00:00** → **ȘTERGE task-ul** (nu mai are sens să fie atribuit)

**Cu deadline:**
- Calculează deadline-ul din `finalized_in` / `finalized_la` / `finish_at`
- Calculează orele până la 00:00
- Aplică următoarele reguli:

**Dacă sunt mai mult de 4 ore până la deadline:**
- **Nu permite amânare** → **Atribuie random** după 2 ore
- **Permite amânare:**
  - **Mai mult de 4 ore până la 00:00** → **Atribuie random** după 2 ore
  - **Mai puțin de 4 ore până la 00:00** → **ȘTERGE task-ul**

**Dacă sunt mai puțin de 4 ore până la deadline:**
- **ȘTERGE task-ul** (indiferent de amânare) - nu mai poate fi finalizat la timp

### 3. Procesul de Atribuire Automată

**Când se decide atribuirea automată:**

1. **Obține angajații din departament**
   - Extrage `department_id` din `department_group_id` (format: `dept_{departmentId}_timestamp_random`)
   - Face request la microserviciul employees: `GET /employees?department={departmentId}`

2. **Selectează angajat random**
   - Alege un angajat aleatoriu din lista departamentului

3. **Actualizează task-ul**
   - Setează `assigned_to_id` cu ID-ul angajatului selectat
   - Păstrează statusul `ASSIGNED`
   - **NU mai șterge alte task-uri** (există deja un singur task)

### 4. Curățare Automată

**Cron Job la Miezul Nopții:**
- Rulează la 00:00 (`@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`)
- Șterge doar task-urile FCFS cu:
  - `assigned_to_id = NULL` (neacceptate)
  - `status = ASSIGNED` (încă active)
- **NU șterge** task-urile cu `status = DEACTIVATED`
- Task-urile DEACTIVATED rămân în istoric pentru raportare și analiză

## API Endpoints

### 1. Execuție Automată
- **Cron Job**: `@Cron('0 */30 * * * *')`
- **Frecvență**: La fiecare 30 de minute

### 2. Execuție Manuală
- **Endpoint**: `POST /cron/run-fcfs-auto-assignment`
- **Permisiuni**: `execution.read_all`, `assignment.read_all`
- **Răspuns**:
```json
{
  "message": "Manual FCFS auto-assignment completed. Found X remaining FCFS assignments.",
  "processedTasks": 5,
  "autoAssignedTasks": 2,
  "deletedTasks": 3
}
```

## Logging

Sistemul oferă logging detaliat pentru:
- Numărul de task-uri FCFS găsite
- Acțiunile luate pentru fiecare task
- Angajații selectați pentru atribuire
- Task-urile șterse din grup
- Erorile întâlnite

## Exemple de Loguri

```
🎯 Starting FCFS auto-assignment cron job...
🎯 Found 3 FCFS assignments to process
✅ Processed FCFS assignment 123: auto_assigned
🎯 Auto-assigned FCFS task 123 to employee 456 (John Doe)
🗑️ Deleted 2 other FCFS assignments from group department_789
🎯 FCFS auto-assignment completed: 3 processed, 1 auto-assigned, 2 deleted
```

## Configurare

### Elemente de Task Necesare

**1. `finalized_in` (opțional)**
- Tip: `finalized_in`
- Format: `"2"` (ore) sau `"2:30"` (ore:minute)
- Scop: Definește deadline-ul pentru task

**2. `allow_postpone` (opțional)**
- Tip: `allow_postpone`
- Valoare: `"true"` sau `"false"`
- Scop: Determină dacă task-ul poate fi amânat

### Configurare Departament

- `department_group_id` trebuie să fie în format: `"department_{departmentId}"`
- Departamentul trebuie să existe în microserviciul locations
- Departamentul trebuie să aibă angajați asignați

## Monitorizare și Debugging

### Verificare Status Task-uri FCFS
```sql
SELECT 
  id, 
  assigned_at, 
  department_group_id, 
  assignment_mode,
  status,
  assigned_to_id
FROM Task_Assignment 
WHERE assignment_mode = 'first_come_first_served' 
  AND department_group_id IS NOT NULL
  AND status = 'assigned';
```

### Verificare Loguri
- Logurile sunt scrise cu prefixul `🎯` pentru FCFS
- Nivelul de logging: `INFO` pentru operațiuni normale, `ERROR` pentru erori

## Limitări și Considerații

1. **Performanță**: Cron job-ul rulează la fiecare 30 de minute
2. **Dependențe**: Depinde de microserviciul locations pentru angajați
3. **Randomizare**: Selectarea angajatului este complet aleatorie
4. **Concurrență**: Nu există protecție împotriva atribuirilor simultane
5. **Rollback**: Nu există mecanism de anulare a atribuirilor automate

## Testare

Pentru testarea funcționalității:

1. **Creează task-uri FCFS** cu `assignment_mode = 'first_come_first_served'`
2. **Așteaptă 2 ore** sau rulează manual endpoint-ul
3. **Verifică logurile** pentru acțiunile luate
4. **Verifică baza de date** pentru atribuirile făcute

## Troubleshooting

### Probleme Comune

**1. Nu se găsesc angajați pentru departament**
- Verifică că `department_group_id` este corect formatat
- Verifică că departamentul există în microserviciul locations
- Verifică că departamentul are angajați asignați

**2. Task-urile nu sunt procesate**
- Verifică că `assignment_mode = 'first_come_first_served'`
- Verifică că `department_group_id` nu este NULL
- Verifică că statusul este `ASSIGNED`

**3. Erori de conectivitate**
- Verifică că microserviciul locations este accesibil
- Verifică URL-ul în `getDepartmentEmployees()`
