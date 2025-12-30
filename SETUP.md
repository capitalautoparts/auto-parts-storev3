# Capital Auto Parts Frontend - Setup Guide

Complete step-by-step guide to get the application running locally.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm or pnpm** - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/capitalautoparts/auto-parts-storev3.git
cd auto-parts-storev3
```

### 2. Install Dependencies

```bash
npm install
```

Or if you prefer pnpm:

```bash
pnpm install
```

**Note**: This will install all required dependencies including:
- React 18 and React DOM
- All Radix UI components (@radix-ui/react-*)
- Tailwind CSS v4 with Vite plugin
- Axios for API calls
- Lucide React for icons
- Sonner for toast notifications
- And all other UI dependencies

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and set your backend API URL:

```env
VITE_API_URL=https://your-aws-backend.com/api
```

**For local development**, if your backend runs on `http://localhost:4000`, you can leave it as:

```env
VITE_API_URL=http://localhost:4000/api
```

### 4. Start Development Server

```bash
npm run dev
```

The application will start at **http://localhost:3000**

You should see:

```
VITE v7.3.0  ready in XXX ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### 5. Open in Browser

Navigate to **http://localhost:3000** in your browser.

You should see the Capital Auto Parts interface with:
- Red header with logo and search bar
- Left sidebar with "Part Catalog" and expandable year tree
- Center content area
- Right shopping cart panel

## Troubleshooting

### Issue: "Cannot find module '@radix-ui/react-*'"

**Solution**: Make sure you ran `npm install` after pulling the latest code:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Failed to load PostCSS config"

**Solution**: This was fixed in the latest commit. Pull the latest code:

```bash
git pull origin main
npm install
npm run dev
```

### Issue: Styles not loading / Unstyled page

**Solution**: Ensure Tailwind CSS is configured correctly. The latest version includes:
- `@tailwindcss/vite` plugin in `vite.config.ts`
- `@import "tailwindcss"` in `src/index.css`
- No `postcss.config.js` file (Tailwind v4 doesn't need it)

If styles still don't load:

```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Issue: API calls failing

**Solution**: Check your `.env` file and ensure `VITE_API_URL` points to your backend.

Test your backend is accessible:

```bash
curl http://localhost:4000/api/vehicles/years
```

If your backend requires CORS, make sure it allows requests from `http://localhost:3000`.

### Issue: "Module not found: Can't resolve '@/hooks/useComposition'"

**Solution**: This was fixed in the latest commit. The hooks are now included:
- `src/hooks/useComposition.ts`
- `src/hooks/useMobile.ts`

Pull the latest code:

```bash
git pull origin main
```

## Building for Production

### 1. Build the Application

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### 2. Preview Production Build Locally

```bash
npm run preview
```

### 3. Deploy

Deploy the `dist/` directory to your hosting provider:

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**AWS S3 + CloudFront:**
```bash
aws s3 sync dist/ s3://your-bucket-name
```

## Environment Variables for Production

When deploying, set `VITE_API_URL` in your hosting provider's environment variables:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Build & Deploy → Environment
- **AWS**: Use CloudFront environment variables or build-time substitution

## Development Workflow

### Making Changes

1. Edit files in `src/`
2. Vite will hot-reload changes automatically
3. Test in browser at `http://localhost:3000`

### Adding New Components

```bash
# Components go in src/components/
touch src/components/MyNewComponent.tsx
```

### Modifying API Calls

Edit `src/lib/api.ts` to add or modify API endpoints.

### Styling

- Global styles: `src/index.css`
- Component styles: Use Tailwind CSS classes
- Theme colors: Edit CSS variables in `src/index.css` under `:root`

## Project Structure

```
capital-auto-parts-frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Radix UI components
│   │   ├── Header.tsx       # Top header
│   │   ├── TreeSidebar.tsx  # Left sidebar
│   │   ├── PartsTable.tsx   # Parts display
│   │   └── RightCartPanel.tsx  # Shopping cart
│   ├── hooks/
│   │   ├── useComposition.ts  # IME composition handling
│   │   └── useMobile.ts       # Mobile detection
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   ├── hooks.ts         # useQuery/useMutation
│   │   └── utils.ts         # Utilities
│   ├── App.tsx              # Main app
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env                     # Your environment variables (not in git)
├── .env.example             # Template
├── README.md                # Project overview
├── API_SPEC.md              # Backend API requirements
└── SETUP.md                 # This file
```

## Next Steps

1. **Connect to your AWS backend** - Update `.env` with your API URL
2. **Test the API integration** - Verify data loads from your backend
3. **Customize branding** - Modify colors in `src/index.css`
4. **Add features** - Implement search, checkout, etc.

## Getting Help

- **Frontend issues**: Check browser console for errors
- **API issues**: Check Network tab in browser DevTools
- **Build issues**: Clear `node_modules` and reinstall
- **Styling issues**: Clear Vite cache with `rm -rf node_modules/.vite`

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run build  # TypeScript errors will show during build

# Pull latest changes
git pull origin main
npm install  # Always reinstall after pulling
```

## Success Checklist

✅ Node.js 18+ installed  
✅ Repository cloned  
✅ Dependencies installed (`npm install`)  
✅ `.env` file created with `VITE_API_URL`  
✅ Dev server running (`npm run dev`)  
✅ Page loads at http://localhost:3000  
✅ Styles are applied (red header, proper layout)  
✅ No console errors  

If all checkboxes are checked, you're ready to start development!
