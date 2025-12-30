# Backend API Specification

This document details the REST API endpoints your AWS backend must implement for the Capital Auto Parts frontend to function correctly.

## Base URL

All endpoints should be prefixed with `/api`. For example:
```
https://your-aws-backend.com/api/vehicles/years
```

## Authentication

Currently, the frontend uses session-based cart management without authentication. For production, consider adding:
- JWT tokens for authenticated users
- API keys for rate limiting
- CORS configuration to allow your frontend domain

## Response Format

All successful responses should return JSON with appropriate HTTP status codes:
- `200 OK` - Successful GET/PUT requests
- `201 Created` - Successful POST requests
- `204 No Content` - Successful DELETE requests
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server errors

## Endpoints

### 1. Get Vehicle Years

Returns all available vehicle years in the database.

**Endpoint**: `GET /api/vehicles/years`

**Query Parameters**: None

**Response**:
```json
[
  { "year": 2024 },
  { "year": 2023 },
  { "year": 2022 }
]
```

**Example SQL** (PostgreSQL):
```sql
SELECT DISTINCT year FROM vehicle_years ORDER BY year DESC;
```

---

### 2. Get Vehicle Makes

Returns all vehicle makes for a given year.

**Endpoint**: `GET /api/vehicles/makes`

**Query Parameters**:
- `year` (optional): Filter makes by year

**Response**:
```json
[
  { "id": 1, "name": "HONDA", "country": "JP" },
  { "id": 2, "name": "FORD", "country": "US" },
  { "id": 3, "name": "BMW", "country": "DE" }
]
```

**Example SQL**:
```sql
SELECT DISTINCT m.id, m.name, m.country
FROM vehicle_makes m
JOIN vehicle_models vm ON vm.make_id = m.id
WHERE vm.year = $1
ORDER BY m.name;
```

---

### 3. Get Vehicle Models

Returns all models for a given make and year.

**Endpoint**: `GET /api/vehicles/models`

**Query Parameters**:
- `makeId` (required): Vehicle make ID
- `year` (required): Vehicle year

**Response**:
```json
[
  { "id": 1, "name": "CIVIC", "makeId": 1 },
  { "id": 2, "name": "ACCORD", "makeId": 1 },
  { "id": 3, "name": "CR-V", "makeId": 1 }
]
```

**Example SQL**:
```sql
SELECT id, name, make_id as "makeId"
FROM vehicle_models
WHERE make_id = $1 AND year = $2
ORDER BY name;
```

---

### 4. Get Vehicle Engines

Returns all engines for a given model.

**Endpoint**: `GET /api/vehicles/engines`

**Query Parameters**:
- `modelId` (required): Vehicle model ID

**Response**:
```json
[
  { "id": 1, "name": "2.0L L4", "modelId": 1 },
  { "id": 2, "name": "1.5L L4 Turbo", "modelId": 1 }
]
```

**Example SQL**:
```sql
SELECT id, name, model_id as "modelId"
FROM vehicle_engines
WHERE model_id = $1
ORDER BY name;
```

---

### 5. Get All Categories

Returns all part categories with their parent-child relationships.

**Endpoint**: `GET /api/categories`

**Query Parameters**: None

**Response**:
```json
[
  { "id": 1, "name": "Brake & Wheel Hub", "parentId": null },
  { "id": 2, "name": "Brake Pad", "parentId": 1 },
  { "id": 3, "name": "Brake Rotor", "parentId": 1 },
  { "id": 4, "name": "Engine", "parentId": null },
  { "id": 5, "name": "Oil Filter", "parentId": 4 }
]
```

**Example SQL**:
```sql
SELECT id, name, parent_id as "parentId"
FROM categories
ORDER BY parent_id NULLS FIRST, name;
```

**Note**: Categories with `parentId: null` are top-level categories. Others are subcategories.

---

### 6. Get Parts by Category

Returns all parts for a given category and vehicle engine combination.

**Endpoint**: `GET /api/parts`

**Query Parameters**:
- `categoryId` (required): Part category ID
- `vehicleEngineId` (optional): Vehicle engine ID for fitment filtering

**Response**:
```json
[
  {
    "id": 1,
    "brand": "AKEBONO",
    "partNumber": "ACT1543",
    "description": "ProACT Ultra-Premium Ceramic Brake Pad Set",
    "price": 42.79,
    "tier": "premium",
    "warranty": "Limited Lifetime",
    "stock": 15,
    "position": "Front"
  },
  {
    "id": 2,
    "brand": "BOSCH",
    "partNumber": "BC1543",
    "description": "Blue Disc Brake Pad Set",
    "price": 35.79,
    "tier": "daily_driver",
    "warranty": "1 Year",
    "stock": 8,
    "position": "Front"
  }
]
```

**Field Descriptions**:
- `price`: Decimal price in dollars (e.g., 42.79)
- `tier`: One of `"economy"`, `"daily_driver"`, `"premium"`, `"performance"`
- `stock`: Quantity available
- `position`: Optional. Common values: "Front", "Rear", "Front Left", "Front Right", etc.

**Example SQL**:
```sql
SELECT 
  p.id,
  p.brand,
  p.part_number as "partNumber",
  p.description,
  p.price,
  p.tier,
  p.warranty,
  p.stock,
  p.position
FROM parts p
JOIN part_fitments pf ON pf.part_id = p.id
WHERE p.category_id = $1
  AND ($2::int IS NULL OR pf.vehicle_engine_id = $2)
  AND p.stock > 0
ORDER BY p.tier, p.price;
```

---

### 7. Get Shopping Cart

Returns the shopping cart for a given session.

**Endpoint**: `GET /api/cart`

**Query Parameters**:
- `sessionId` (required): Unique session identifier

**Response**:
```json
{
  "id": 1,
  "sessionId": "session-1234567890",
  "items": [
    {
      "id": 1,
      "partId": 1,
      "quantity": 2,
      "part": {
        "id": 1,
        "brand": "AKEBONO",
        "partNumber": "ACT1543",
        "description": "ProACT Ultra-Premium Ceramic Brake Pad Set",
        "price": 42.79,
        "tier": "premium",
        "warranty": "Limited Lifetime",
        "stock": 15,
        "position": "Front"
      }
    }
  ]
}
```

**Example SQL**:
```sql
SELECT 
  c.id,
  c.session_id as "sessionId",
  json_agg(
    json_build_object(
      'id', ci.id,
      'partId', ci.part_id,
      'quantity', ci.quantity,
      'part', json_build_object(
        'id', p.id,
        'brand', p.brand,
        'partNumber', p.part_number,
        'description', p.description,
        'price', p.price,
        'tier', p.tier,
        'warranty', p.warranty,
        'stock', p.stock,
        'position', p.position
      )
    )
  ) as items
FROM carts c
LEFT JOIN cart_items ci ON ci.cart_id = c.id
LEFT JOIN parts p ON p.id = ci.part_id
WHERE c.session_id = $1
GROUP BY c.id, c.session_id;
```

**Note**: If no cart exists for the session, create one and return an empty cart.

---

### 8. Add Item to Cart

Adds a part to the shopping cart or increments quantity if already present.

**Endpoint**: `POST /api/cart/items`

**Request Body**:
```json
{
  "sessionId": "session-1234567890",
  "partId": 1,
  "quantity": 1
}
```

**Response**: Same as GET /api/cart (returns the updated cart)

**Logic**:
1. Find or create cart for `sessionId`
2. Check if `partId` already exists in cart
   - If yes: increment quantity by `quantity`
   - If no: add new cart item
3. Return updated cart

**Example SQL**:
```sql
-- Find or create cart
INSERT INTO carts (session_id) VALUES ($1)
ON CONFLICT (session_id) DO NOTHING
RETURNING id;

-- Add or update cart item
INSERT INTO cart_items (cart_id, part_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (cart_id, part_id) 
DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;
```

---

### 9. Update Cart Item Quantity

Updates the quantity of a specific cart item.

**Endpoint**: `PUT /api/cart/items/:itemId`

**URL Parameters**:
- `itemId`: Cart item ID

**Request Body**:
```json
{
  "quantity": 3
}
```

**Response**: Same as GET /api/cart (returns the updated cart)

**Example SQL**:
```sql
UPDATE cart_items
SET quantity = $1
WHERE id = $2;
```

---

### 10. Remove Item from Cart

Removes a specific item from the shopping cart.

**Endpoint**: `DELETE /api/cart/items/:itemId`

**URL Parameters**:
- `itemId`: Cart item ID

**Response**: `204 No Content`

**Example SQL**:
```sql
DELETE FROM cart_items WHERE id = $1;
```

---

## Database Schema Recommendations

### Tables

```sql
-- Vehicle hierarchy
CREATE TABLE vehicle_years (
  year INT PRIMARY KEY
);

CREATE TABLE vehicle_makes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(2)  -- ISO country code
);

CREATE TABLE vehicle_models (
  id SERIAL PRIMARY KEY,
  make_id INT REFERENCES vehicle_makes(id),
  year INT REFERENCES vehicle_years(year),
  name VARCHAR(100) NOT NULL
);

CREATE TABLE vehicle_engines (
  id SERIAL PRIMARY KEY,
  model_id INT REFERENCES vehicle_models(id),
  name VARCHAR(100) NOT NULL
);

-- Categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  parent_id INT REFERENCES categories(id)
);

-- Parts
CREATE TABLE parts (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id),
  brand VARCHAR(100) NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  tier VARCHAR(20) CHECK (tier IN ('economy', 'daily_driver', 'premium', 'performance')),
  warranty VARCHAR(100),
  stock INT DEFAULT 0,
  position VARCHAR(50)
);

-- Part fitments (which parts fit which vehicles)
CREATE TABLE part_fitments (
  id SERIAL PRIMARY KEY,
  part_id INT REFERENCES parts(id),
  vehicle_engine_id INT REFERENCES vehicle_engines(id),
  UNIQUE(part_id, vehicle_engine_id)
);

-- Shopping cart
CREATE TABLE carts (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INT REFERENCES carts(id) ON DELETE CASCADE,
  part_id INT REFERENCES parts(id),
  quantity INT DEFAULT 1,
  UNIQUE(cart_id, part_id)
);
```

### Indexes

```sql
CREATE INDEX idx_vehicle_models_make_year ON vehicle_models(make_id, year);
CREATE INDEX idx_vehicle_engines_model ON vehicle_engines(model_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_parts_category ON parts(category_id);
CREATE INDEX idx_part_fitments_engine ON part_fitments(vehicle_engine_id);
CREATE INDEX idx_part_fitments_part ON part_fitments(part_id);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
```

## Testing Your API

Use curl or Postman to test each endpoint:

```bash
# Get years
curl http://localhost:4000/api/vehicles/years

# Get makes for 2010
curl "http://localhost:4000/api/vehicles/makes?year=2010"

# Get models for Honda (makeId=1) in 2010
curl "http://localhost:4000/api/vehicles/models?makeId=1&year=2010"

# Get engines for Civic (modelId=1)
curl "http://localhost:4000/api/vehicles/engines?modelId=1"

# Get all categories
curl http://localhost:4000/api/categories

# Get brake pads (categoryId=2) for 2.0L L4 (engineId=1)
curl "http://localhost:4000/api/parts?categoryId=2&vehicleEngineId=1"

# Get cart
curl "http://localhost:4000/api/cart?sessionId=test-session"

# Add to cart
curl -X POST http://localhost:4000/api/cart/items \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session","partId":1,"quantity":1}'

# Update quantity
curl -X PUT http://localhost:4000/api/cart/items/1 \
  -H "Content-Type: application/json" \
  -d '{"quantity":3}'

# Remove from cart
curl -X DELETE http://localhost:4000/api/cart/items/1
```

## CORS Configuration

Your backend must allow requests from your frontend domain. Example Express.js configuration:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3000',  // Development
    'https://your-frontend-domain.com'  // Production
  ],
  credentials: true
}));
```

## Error Handling

Return appropriate error responses:

```json
{
  "error": "Resource not found",
  "message": "Part with ID 999 does not exist",
  "statusCode": 404
}
```

## Performance Considerations

1. **Caching**: Cache vehicle years, makes, and categories (they rarely change)
2. **Pagination**: Add pagination to parts endpoint for large result sets
3. **Database Indexes**: Ensure all foreign keys and frequently queried columns are indexed
4. **Connection Pooling**: Use connection pooling for database connections
5. **Rate Limiting**: Implement rate limiting to prevent abuse

## Security Considerations

1. **SQL Injection**: Use parameterized queries
2. **Input Validation**: Validate all query parameters and request bodies
3. **CORS**: Restrict CORS to known frontend domains
4. **Rate Limiting**: Implement rate limiting per IP/session
5. **HTTPS**: Use HTTPS in production
