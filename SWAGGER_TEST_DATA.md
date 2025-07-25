# 📋 Date de Test pentru Swagger/Postman

## 🎯 Endpoint-uri pentru Testarea Noii Structuri

### 1. Crearea unui Produs
**POST** `/stock/products`
```json
{
  "name": "Făină tip 000",
  "unit": "g"
}
```

### 2. Crearea unei Intrări în Stoc
**POST** `/stock/items`
```json
{
  "product_id": 1,
  "quantity": 5000,
  "price": 0.003,
  "entry_date": "2025-01-24",
  "expiration_date": "2025-12-31"
}
```

### 3. Crearea unei Categorii de Rețete
**POST** `/recipes/categories`
```json
{
  "name": "Pizza & Paste",
  "description": "Rețete pentru pizza și paste italiene"
}
```

### 4. Crearea unei Rețete (Noua Structură)
**POST** `/recipes`
```json
{
  "name": "Pizza Margherita",
  "description": "1. Amestecă făina cu apa și drojdia pentru aluat\n2. Întinde aluatul în formă de cerc\n3. Aplică sosul de roșii uniform\n4. Adaugă mozzarella bucățele\n5. Coace la 220°C timp de 12-15 minute",
  "category_id": 1,
  "expiration_days": 24,
  "quantity": 1800
}
```

### 5. Adăugarea unui Ingredient la Rețetă
**POST** `/recipes/recipe-products`
```json
{
  "recipe_id": 1,
  "product_id": 1,
  "quantity": 300,
  "notes": "Făină pentru aluat"
}
```

### 6. Crearea unui Preparat
**POST** `/recipe-preparations`
```json
{
  "recipe_id": 1,
  "quantity": 3600,
  "produced_at": "2025-01-24T10:00:00.000Z"
}
```

## 🔍 Endpoint-uri pentru Verificare

### Obținerea Rețetelor cu Noua Structură
**GET** `/recipes`

**Răspuns așteptat:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Pizza Margherita",
      "description": "1. Amestecă făina cu apa...",
      "category_id": 1,
      "created_at": "2025-01-24T10:00:00.000Z",
      "updated_at": "2025-01-24T10:00:00.000Z",
      "expiration_days": 24,
      "quantity": 1800,
      "category": {
        "id": 1,
        "name": "Pizza & Paste"
      },
      "recipe_products": [
        {
          "id": 1,
          "quantity": 300,
          "notes": "Făină pentru aluat",
          "product": {
            "id": 1,
            "name": "Făină tip 000",
            "unit": "g"
          }
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

### Obținerea Statisticilor Actualizate
**GET** `/recipes/statistics/overview`

**Răspuns așteptat:**
```json
{
  "totalRecipes": 2,
  "totalCategories": 2,
  "totalProducts": 4,
  "avgQuantity": 1300,
  "avgExpirationHours": 18,
  "mostUsedProducts": [
    {
      "name": "Făină tip 000",
      "usage_count": "2"
    }
  ]
}
```

## 🧪 Scenarii de Testare

### Scenariul 1: Crearea unei Rețete Complete
1. **POST** `/recipes/categories` - creează categoria
2. **POST** `/stock/products` - creează produsele necesare
3. **POST** `/stock/items` - adaugă produsele în stoc
4. **POST** `/recipes` - creează rețeta cu noua structură
5. **POST** `/recipes/recipe-products` - adaugă ingredientele
6. **GET** `/recipes/{id}` - verifică rețeta creată

### Scenariul 2: Testarea Scalării
1. **POST** `/recipe-preparations` cu `quantity` diferită de rețeta originală
2. Verifică că sistemul calculează corect factorul de scalare
3. Verifică că ingredientele sunt deduse din stoc proporțional

### Scenariul 3: Actualizarea unei Rețete
1. **PATCH** `/recipes/{id}` cu noile câmpuri:
```json
{
  "name": "Pizza Margherita Actualizată",
  "quantity": 2000,
  "expiration_days": 36
}
```

## ❌ Teste pentru Validare

### Testează că Câmpurile Vechi Nu Mai Funcționează
**POST** `/recipes` (ar trebui să dea eroare)
```json
{
  "name": "Test Recipe",
  "description": "Test",
  "category_id": 1,
  "servings": 4,
  "difficulty": "easy",
  "preparation_time": 30,
  "cooking_time": 45
}
```

**Răspuns așteptat:** Eroare de validare pentru câmpurile inexistente.

### Testează Validarea Câmpurilor Noi
**POST** `/recipes` (ar trebui să dea eroare)
```json
{
  "name": "Test Recipe",
  "description": "Test",
  "category_id": 1
}
```

**Răspuns așteptat:** Eroare pentru `expiration_days` și `quantity` lipsă.

## 🔧 Headers Necesare

Pentru toate request-urile POST/PATCH:
```
Content-Type: application/json
```

## 🎯 Verificări de Succes

### ✅ Structura Corectă:
- Rețetele au câmpurile: `id`, `name`, `description`, `category_id`, `created_at`, `updated_at`, `expiration_days`, `quantity`
- Rețetele NU au câmpurile: `servings`, `difficulty`, `preparation_time`, `cooking_time`, `calories_per_serving`, `image_url`, `author`, `instructions`

### ✅ Validări Funcționale:
- `expiration_days` este obligatoriu și numeric
- `quantity` este obligatoriu și numeric
- `description` conține instrucțiunile de preparare

### ✅ Relații Intacte:
- Relația cu categoriile funcționează
- Relația cu ingredientele (recipe_products) funcționează
- Preparatele se pot crea pe baza rețetelor

## 🚀 Testare Rapidă cu cURL

```bash
# Testează că backend-ul rulează
curl -X GET http://localhost:3000/recipes

# Creează o rețetă cu noua structură
curl -X POST http://localhost:3000/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pizza",
    "description": "Test description",
    "category_id": 1,
    "expiration_days": 24,
    "quantity": 1500
  }'
```

Folosește aceste date pentru a testa complet noua structură în Swagger sau Postman! 🎯