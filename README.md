# Capital Auto Parts - Frontend Application

A RockAuto-style auto parts e-commerce frontend built with React, TypeScript, and Tailwind CSS. This application connects to your existing AWS backend via REST APIs.

## Features

- **Three-Column Layout**: Left sidebar (vehicle/category tree), center content (parts table), right sidebar (shopping cart)
- **Expandable Tree Navigation**: Year → Make → Model → Engine → Category → Part Type hierarchy
- **Tier-Based Pricing**: Economy, Daily Driver, Premium, and Performance tiers with color-coded badges
- **Position Grouping**: Parts grouped by position (Front, Rear, etc.) in table format
- **Persistent Shopping Cart**: Always visible on the right side with quantity controls
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Capital Auto Parts Branding**: Red (#c40c0c) primary color scheme

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible UI components
- **Axios** - HTTP client for API calls
- **Wouter** - Lightweight routing (if needed for future pages)
- **Sonner** - Toast notifications

## Prerequisites

- **Node.js** 18+ and npm/pnpm
- **AWS Backend API** with the following endpoints (see API Requirements below)

## Installation

1. **Clone or extract this repository**

```bash
cd capital-auto-parts-frontend
```

2. **Install dependencies**

```bash
npm install
# or
pnpm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and set your AWS backend URL:

```env
VITE_API_URL=https://your-aws-backend.com/api
```

4. **Start the development server**

```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
npm run build
# or
pnpm build
```

The built files will be in the `dist/` directory. Deploy this directory to your hosting provider (Vercel, Netlify, AWS S3 + CloudFront, etc.).

## API Requirements

Your AWS backend must implement the following REST API endpoints:

### Vehicle Endpoints

```
GET /api/vehicles/years
Response: [{ year: number }]

GET /api/vehicles/makes?year=2010
Response: [{ id: number, name: string, country?: string }]

GET /api/vehicles/models?makeId=1&year=2010
Response: [{ id: number, name: string, makeId: number }]

GET /api/vehicles/engines?modelId=1
Response: [{ id: number, name: string, modelId: number }]
```

### Category Endpoints

```
GET /api/categories
Response: [{ id: number, name: string, parentId: number | null }]
```

### Parts Endpoints

```
GET /api/parts?categoryId=1&vehicleEngineId=1
Response: [{
  id: number,
  brand: string,
  partNumber: string,
  description: string,
  price: number,  // in dollars (e.g., 42.79)
  tier: 'economy' | 'daily_driver' | 'premium' | 'performance',
  warranty: string,
  stock: number,
  position?: string  // e.g., "Front", "Rear"
}]
```

### Cart Endpoints

```
GET /api/cart?sessionId=xxx
Response: {
  id: number,
  sessionId: string,
  items: [{
    id: number,
    partId: number,
    quantity: number,
    part?: Part  // Include full part details
  }]
}

POST /api/cart/items
Body: { sessionId: string, partId: number, quantity: number }
Response: Cart (same as GET /api/cart)

PUT /api/cart/items/:itemId
Body: { quantity: number }
Response: Cart (same as GET /api/cart)

DELETE /api/cart/items/:itemId
Response: 204 No Content
```

## Project Structure

```
capital-auto-parts-frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Radix UI components (Button, Badge, etc.)
│   │   ├── Header.tsx       # Top header with logo, search, cart icon
│   │   ├── TreeSidebar.tsx  # Left expandable tree navigation
│   │   ├── PartsTable.tsx   # Center parts table with position grouping
│   │   └── RightCartPanel.tsx  # Right shopping cart panel
│   ├── lib/
│   │   ├── api.ts           # API client and type definitions
│   │   ├── hooks.ts         # Custom React hooks (useQuery, useMutation)
│   │   └── utils.ts         # Utility functions
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles and Tailwind config
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Customization

### Branding Colors

Edit `src/index.css` to change the color scheme:

```css
:root {
  --primary: 0 84% 40%;  /* Red #c40c0c */
  --primary-foreground: 0 0% 100%;
  /* ... other colors */
}
```

### API Base URL

The API base URL can be configured in three ways (in order of precedence):

1. **Environment variable**: `VITE_API_URL` in `.env`
2. **Vite proxy**: Configured in `vite.config.ts` for development
3. **Default**: `http://localhost:4000/api`

### Adding New Features

- **Search functionality**: Update `Header.tsx` `onSearchChange` handler in `App.tsx`
- **Checkout flow**: Implement `handleCheckout` in `App.tsx`
- **Part images**: Add `imageUrl` field to Part type and display in `PartsTable.tsx`
- **Comparison tool**: Add checkboxes to `PartsTable.tsx` and create comparison view

## Development Tips

### Hot Module Replacement (HMR)

Vite provides instant HMR. Changes to components will reflect immediately without full page reload.

### Type Safety

All API responses are typed. If your backend returns different shapes, update the types in `src/lib/api.ts`.

### Error Handling

API errors are caught and displayed as toast notifications. Customize error messages in the mutation `onError` callbacks in `App.tsx`.

### Session Management

The app uses a client-side generated `sessionId` for cart persistence. For production, consider:
- Storing `sessionId` in localStorage
- Using JWT tokens for authenticated users
- Implementing server-side session management

## Deployment

### Vercel

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### AWS S3 + CloudFront

```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name
# Configure CloudFront distribution to point to the S3 bucket
```

### Environment Variables in Production

Make sure to set `VITE_API_URL` in your hosting provider's environment variables:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment
- **AWS**: Use CloudFront environment variables or build-time substitution

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console, your AWS backend needs to allow requests from your frontend domain:

```javascript
// Example Express.js CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
  credentials: true
}));
```

### API Connection Issues

1. Check that `VITE_API_URL` is set correctly
2. Verify your backend is running and accessible
3. Check browser Network tab for failed requests
4. Ensure API endpoints match the expected format (see API Requirements)

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

## License

MIT

## Support

For issues related to:
- **Frontend bugs**: Check browser console for errors
- **Backend integration**: Verify API endpoints match the requirements
- **Styling issues**: Review Tailwind CSS classes and `index.css`
