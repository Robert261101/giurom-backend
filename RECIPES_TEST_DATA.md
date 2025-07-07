# 🍽️ Test Data pentru Modulul Rețetar

## 📋 Endpoint-uri și Date de Test

### 1. **Categorii de Rețete** (`/recipes/categories`)

#### POST `/recipes/categories` - Creează o categorie nouă
```json
{
  "name": "Supe și Ciorbe",
  "description": "Rețete pentru supe, ciorbe și mâncăruri lichide"
}
```

#### POST `/recipes/categories` - Alte categorii
```json
{
  "name": "Deserturi",
  "description": "Rețete dulci și deserturi tradiționale"
}
```

```json
{
  "name": "Feluri Principale",
  "description": "Mâncăruri principale cu carne, pește sau vegetariene"
}
```

```json
{
  "name": "Salate",
  "description": "Salate proaspete și nutritive"
}
```

#### GET `/recipes/categories` - Listează categorii
- Fără parametri: returnează toate categoriile
- Cu parametri: `?page=1&limit=10&search=supe`

#### GET `/recipes/categories/1` - Obține o categorie
- Returnează categoria cu ID-ul 1 și rețetele asociate

#### PATCH `/recipes/categories/1` - Actualizează o categorie
```json
{
  "name": "Supe și Ciorbe Tradiționale",
  "description": "Rețete tradiționale pentru supe și ciorbe românești"
}
```

#### DELETE `/recipes/categories/1` - Șterge o categorie
- Doar dacă nu are rețete asociate

---

### 2. **Ingrediente** (`/recipes/ingredients`)

#### POST `/recipes/ingredients` - Creează un ingredient nou
```json
{
  "name": "Cartofi",
  "description": "Cartofi proaspeți, ideal pentru gătit",
  "unit": "grame",
  "category": "Legume"
}
```

#### POST `/recipes/ingredients` - Alte ingrediente
```json
{
  "name": "Morcovi",
  "description": "Morcovi proaspeți, bogate în vitamine",
  "unit": "grame",
  "category": "Legume"
}
```

```json
{
  "name": "Ceapă",
  "description": "Ceapă albă sau roșie pentru aromatizare",
  "unit": "grame",
  "category": "Legume"
}
```

```json
{
  "name": "Ulei de măsline",
  "description": "Ulei extra virgin pentru gătit",
  "unit": "ml",
  "category": "Grăsimi"
}
```

```json
{
  "name": "Sare",
  "description": "Sare de masă pentru condimentare",
  "unit": "grame",
  "category": "Condimente"
}
```

#### GET `/recipes/ingredients` - Listează ingrediente
- Fără parametri: returnează toate ingredientele
- Cu parametri: `?page=1&limit=10&search=cartofi&category=legume`

#### GET `/recipes/ingredients/1` - Obține un ingredient
- Returnează ingredientul cu ID-ul 1 și rețetele în care este folosit

#### PATCH `/recipes/ingredients/1` - Actualizează un ingredient
```json
{
  "name": "Cartofi Roșii",
  "description": "Cartofi roșii proaspeți, perfecte pentru salate",
  "unit": "grame",
  "category": "Legume"
}
```

#### DELETE `/recipes/ingredients/1` - Șterge un ingredient
- Doar dacă nu este folosit în nicio rețetă

---

### 3. **Rețete** (`/recipes`)

#### POST `/recipes` - Creează o rețetă nouă
```json
{
  "name": "Supă de legume cu cartofi",
  "description": "O supă delicioasă și nutritivă, perfectă pentru zilele reci",
  "instructions": "1. Spălați și tăiați legumele în cubulețe mici\n2. Încălziți uleiul într-o oală mare\n3. Adăugați ceapa și prăjiți până devine transparentă\n4. Adăugați morcovii și cartofii\n5. Turnați apa și adăugați sarea\n6. Lăsați la fiert 30-40 de minute\n7. Se servește cald cu pătrunjel proaspăt",
  "category_id": 1,
  "preparation_time": 15,
  "cooking_time": 40,
  "servings": 4,
  "difficulty": "easy",
  "calories_per_serving": 180,
  "author": "Chef Maria"
}
```

#### POST `/recipes` - Alte rețete
```json
{
  "name": "Salată de cartofi cu maioneză",
  "description": "Salată tradițională românească perfectă pentru orice ocazie",
  "instructions": "1. Fierbeți cartofii în apă sărată până sunt moi\n2. Lăsați să se răcească și tăiați în cubulețe\n3. Adăugați maioneza și amestecați ușor\n4. Condimentați cu sare și piper\n5. Lăsați la rece 30 de minute înainte de servire",
  "category_id": 4,
  "preparation_time": 20,
  "cooking_time": 25,
  "servings": 6,
  "difficulty": "easy",
  "calories_per_serving": 250,
  "author": "Chef Ion"
}
```

```json
{
  "name": "Piept de pui la grătar cu legume",
  "description": "Piept de pui sănătos cu legume la grătar",
  "instructions": "1. Marinați pieptul de pui cu ulei, sare și condimente\n2. Încălziți grătarul la foc mediu\n3. Gătiți pieptul 6-8 minute pe fiecare parte\n4. Gătiți legumele la grătar 3-4 minute\n5. Se servește cu salată verde",
  "category_id": 3,
  "preparation_time": 30,
  "cooking_time": 20,
  "servings": 2,
  "difficulty": "medium",
  "calories_per_serving": 320,
  "author": "Chef Ana"
}
```

#### GET `/recipes` - Listează rețete
- Fără parametri: returnează toate rețetele
- Cu parametri: `?page=1&limit=10&search=supă&category_id=1&difficulty=easy&max_cooking_time=60`

#### GET `/recipes/1` - Obține o rețetă
- Returnează rețeta cu ID-ul 1, categoria și ingredientele

#### PATCH `/recipes/1` - Actualizează o rețetă
```json
{
  "name": "Supă de legume tradițională cu cartofi",
  "description": "O supă delicioasă și nutritivă, perfectă pentru zilele reci",
  "cooking_time": 45,
  "difficulty": "medium"
}
```

#### DELETE `/recipes/1` - Șterge o rețetă
- Șterge rețeta și toate asocierile cu ingredientele

---

### 4. **Asocieri Rețetă-Ingredient** (`/recipes/recipe-ingredients`)

#### POST `/recipes/recipe-ingredients` - Adaugă ingredient la rețetă
```json
{
  "recipe_id": 1,
  "ingredient_id": 1,
  "quantity_grams": 500,
  "notes": "Tăiați în cubulețe mici"
}
```

#### POST `/recipes/recipe-ingredients` - Alte asocieri
```json
{
  "recipe_id": 1,
  "ingredient_id": 2,
  "quantity_grams": 200,
  "notes": "Tăiați în felii"
}
```

```json
{
  "recipe_id": 1,
  "ingredient_id": 3,
  "quantity_grams": 100,
  "notes": "Tăiați fin"
}
```

```json
{
  "recipe_id": 1,
  "ingredient_id": 4,
  "quantity_grams": 30,
  "notes": "Pentru prăjit"
}
```

```json
{
  "recipe_id": 1,
  "ingredient_id": 5,
  "quantity_grams": 10,
  "notes": "Pentru condimentare"
}
```

#### GET `/recipes/1/ingredients` - Listează ingredientele unei rețete
- Returnează toate ingredientele folosite în rețeta cu ID-ul 1

#### PATCH `/recipes/recipe-ingredients/1` - Actualizează cantitatea
```json
{
  "quantity_grams": 600,
  "notes": "Tăiați în cubulețe mai mari"
}
```

#### DELETE `/recipes/recipe-ingredients/1` - Elimină ingredient din rețetă
- Șterge asocierea dintre rețetă și ingredient

---

### 5. **Statistici** (`/recipes/statistics/overview`)

#### GET `/recipes/statistics/overview`
- Returnează statistici complete despre rețete, categorii și ingrediente

---

## 🔧 Ordinea Recomandată de Testare

1. **Creează categorii** (POST `/recipes/categories`)
2. **Creează ingrediente** (POST `/recipes/ingredients`)
3. **Creează rețete** (POST `/recipes`)
4. **Adaugă ingrediente la rețete** (POST `/recipes/recipe-ingredients`)
5. **Testează listările** (GET endpoints)
6. **Testează actualizările** (PATCH endpoints)
7. **Testează statisticile** (GET `/recipes/statistics/overview`)

## ⚠️ Note Importante

- **Categorii**: Nu pot fi șterse dacă au rețete asociate
- **Ingrediente**: Nu pot fi șterse dacă sunt folosite în rețete
- **Rețete**: Se șterg automat și asocierile cu ingredientele
- **Asocieri**: Nu pot exista duplicate (aceeași rețetă + același ingredient)

## 🎯 Testare în Swagger

1. Deschide `http://localhost:3001/api/docs`
2. Navighează la secțiunea "recipes"
3. Testează endpoint-urile în ordinea recomandată
4. Verifică răspunsurile și validările 