# Multi Brand Footwear - Inventory Management System

A modern, responsive single-page web application for managing footwear inventory, sales, and purchases. Built with pure HTML, CSS, and JavaScript - no frameworks required!

## 🚀 Features

### 1. **Hero Section**
- Eye-catching landing page with store branding
- Call-to-action button for smooth navigation
- Responsive background with overlay

### 2. **Inventory Management**
- ✅ Add, edit, and delete products
- 🔍 Real-time search functionality
- 🏷️ Filter by category (Men's, Women's, Kids', Sports, Casual, Formal)
- 📊 Visual product cards with images
- 💾 Automatic data persistence using localStorage
- 📦 Stock level indicators (low stock warnings)

### 3. **Sales Recording**
- Record sales transactions
- Auto-populate product prices
- Multiple payment methods (Cash, Card, UPI, Online)
- Customer name tracking (optional)
- Automatic inventory updates
- Recent sales history display

### 4. **Purchase Management**
- Record new stock purchases
- Track supplier information
- Purchase date recording
- Cost price tracking
- Automatic inventory updates
- Recent purchase history

### 5. **Reports & Analytics**
- 💰 Today's sales summary
- 📈 Weekly sales tracking
- 📦 Total products count
- ⚠️ Low stock alerts (below 10 units)
- 🏆 Top selling products
- Interactive data tables

### 6. **User Experience**
- 🌓 Dark mode toggle
- 📱 Mobile-first responsive design
- 🎨 Clean and modern UI
- ⌨️ Keyboard shortcuts (Ctrl+K for search, ESC to close modals)
- 🔔 Success/error notifications
- ✨ Smooth animations and transitions
- 📍 Sticky navigation bar

## 🛠️ Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox, animations
- **JavaScript (ES6+)** - Classes, localStorage API, DOM manipulation
- **No external libraries or frameworks!**

## 📦 Project Structure

```
multibrandfootwear/
├── index.html          # Main HTML structure
├── styles.css          # Complete styling with dark mode
├── script.js           # All application logic
└── README.md          # This file
```

## 🚀 Getting Started

### Option 1: Direct File Opening
Simply open `index.html` in any modern web browser.

### Option 2: Local Server (Recommended)

**Using Python:**
```bash
cd multibrandfootwear
python -m http.server 8000
```

**Using Node.js (with npx):**
```bash
cd multibrandfootwear
npx serve
```

**Using PHP:**
```bash
cd multibrandfootwear
php -S localhost:8000
```

Then open your browser and navigate to `http://localhost:8000`

## 💡 Usage Guide

### Adding a Product
1. Click the **+** floating action button (bottom right)
2. Fill in product details (name, category, size, price, quantity, brand)
3. Optionally add an image URL
4. Click "Save Product"

### Recording a Sale
1. Navigate to the **Sales** section
2. Select a product from the dropdown
3. Enter quantity and price (auto-filled)
4. Choose payment method
5. Optionally add customer name
6. Click "Record Sale"

### Recording a Purchase
1. Navigate to the **Purchases** section
2. Select a product to restock
3. Enter quantity and cost price
4. Enter supplier name
5. Select purchase date
6. Click "Record Purchase"

### Managing Products
- **Edit**: Click the "✏️ Edit" button on any product card
- **Delete**: Click the "🗑️ Delete" button (requires confirmation)
- **Search**: Use the search bar to filter products
- **Filter**: Use the category dropdown to filter by type

### Viewing Reports
Navigate to the **Reports** section to view:
- Sales statistics (today and weekly)
- Total products count
- Low stock alerts
- Top selling products

## 🎨 Design Features

### Mobile-First Approach
- Responsive grid layouts
- Touch-friendly buttons (minimum 44x44px)
- Collapsible navigation menu
- Optimized for screens from 320px to 1920px+

### Color Scheme
- **Primary**: Blue (#2563eb)
- **Secondary**: Purple (#7c3aed)
- **Accent**: Amber (#f59e0b)
- **Success**: Green (#10b981)
- **Danger**: Red (#ef4444)

### Dark Mode
Toggle between light and dark themes using the moon/sun icon in the navigation bar. Preference is saved in localStorage.

## 💾 Data Storage

All data is stored in the browser's localStorage:
- **Products**: All inventory items
- **Sales**: Transaction history
- **Purchases**: Purchase records
- **Dark Mode**: User preference

### Initial Sample Data
The app comes with 4 sample products to demonstrate functionality:
- Nike Air Max 270
- Adidas Ultraboost
- Puma RS-X
- Women's Ankle Boots

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + K` - Focus search bar
- `ESC` - Close modal dialogs

## 🔧 Customization

### Changing Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #7c3aed;
    /* ... more variables */
}
```

### Modifying Categories
Update the category options in both `index.html` (form dropdowns) and `script.js` (getCategoryName function).

### Adjusting Low Stock Threshold
In `script.js`, modify the `getLowStockProducts()` method:
```javascript
getLowStockProducts(threshold = 10) // Change default value
```

## 🌐 Deployment

This is a static website and can be deployed to any hosting platform:

### GitHub Pages
1. Create a GitHub repository
2. Push the files
3. Enable GitHub Pages in repository settings
4. Access via `https://yourusername.github.io/repository-name`

### Netlify
1. Drag and drop the folder to Netlify
2. Or connect your GitHub repository
3. Deploy automatically

### Vercel
```bash
npm i -g vercel
cd multibrandfootwear
vercel
```

### Other Options
- Firebase Hosting
- Surge.sh
- AWS S3 + CloudFront
- Any web server (Apache, Nginx, etc.)

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Known Limitations

- Data is stored locally (not synchronized across devices)
- No backend authentication
- Images must be hosted externally (URLs only)
- No data backup feature (can be exported manually)

## 🔐 Future Enhancements

- [ ] Data export/import functionality
- [ ] Print receipts for sales
- [ ] Barcode scanning support
- [ ] Multiple store locations
- [ ] Employee management
- [ ] Advanced analytics with charts
- [ ] PDF report generation
- [ ] Email notifications for low stock
- [ ] Backend API integration
- [ ] PWA support for offline functionality

## 📄 License

This project is open source and available for personal and commercial use.

## 👨‍💻 Developer Notes

### Debugging
The inventory manager is exposed to the browser console:
```javascript
window.inventory // Access the inventory object
```

### Data Reset
To clear all data and start fresh:
```javascript
localStorage.clear()
location.reload()
```

## 🤝 Contributing

Feel free to fork this project and make improvements! Some ideas:
- Add more product fields (SKU, barcode, etc.)
- Implement data visualization charts
- Add print functionality
- Create a backend API version
- Add multi-language support

## 📞 Support

For issues or questions, please open an issue in the repository or contact the development team.

---

**Built with ❤️ for Multi Brand Footwear**

*Version 1.0.0 - October 2025*
