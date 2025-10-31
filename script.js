// ===================================
// FIREBASE CONFIGURATION
// ===================================
const firebaseConfig = {
    apiKey: "AIzaSyA_Hwi9q-2mU3tfQXUiFUQYkz3V6hPu01k",
    authDomain: "multibrandfootwear-80ce7.firebaseapp.com",
    projectId: "multibrandfootwear-80ce7",
    storageBucket: "multibrandfootwear-80ce7.firebasestorage.app",
    messagingSenderId: "1007592141163",
    appId: "1:1007592141163:web:1cb6f8b7a3811323369c2e",
    measurementId: "G-ME9YZLJ5B5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ===================================
// DATA STORAGE & STATE MANAGEMENT
// ===================================

class InventoryManager {
    constructor() {
        this.products = [];
        this.sales = [];
        this.purchases = [];
        this.transportExpenses = [];
        this.currentEditId = null;
        this.initialized = false;
    }



    // Firebase methods
    async initializeData() {
        try {
            // Load products from Firebase
            const productsSnapshot = await db.collection('products').get();
            this.products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load sales from Firebase
            const salesSnapshot = await db.collection('sales').orderBy('date', 'desc').get();
            this.sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load transport expenses from Firebase
            const transportSnapshot = await db.collection('transportExpenses').orderBy('date', 'desc').get();
            this.transportExpenses = transportSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing data from Firebase:', error);
            showNotification('Error loading data. Please refresh the page.', 'error');
            return false;
        }
    }

    // Product CRUD operations
    async addProduct(product) {
        try {
            product.id = Date.now();
            // Save to both products (active) and productHistory (permanent record)
            await db.collection('products').doc(product.id.toString()).set(product);
            await db.collection('productHistory').doc(product.id.toString()).set(product);
            this.products.push(product);
            return product;
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }

    async updateProduct(id, updatedProduct) {
        try {
            const index = this.products.findIndex(p => p.id == id);
            if (index !== -1) {
                const updatedProductData = { ...this.products[index], ...updatedProduct, id };
                this.products[index] = updatedProductData;
                
                // Always update productHistory (permanent record)
                await db.collection('productHistory').doc(id.toString()).update(updatedProduct);
                
                // Check if stock is 0, if so, remove from active products
                if (updatedProductData.quantity === 0) {
                    await db.collection('products').doc(id.toString()).delete();
                    this.products.splice(index, 1);
                    return updatedProductData;
                } else {
                    // Update active products collection
                    await db.collection('products').doc(id.toString()).update(updatedProduct);
                    return updatedProductData;
                }
            }
            return null;
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            // Delete from both collections
            await db.collection('products').doc(id.toString()).delete();
            await db.collection('productHistory').doc(id.toString()).delete();
            this.products = this.products.filter(p => p.id != id);
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }

    getProduct(id) {
        return this.products.find(p => p.id == id);
    }

    // Sales operations
    async recordSale(sale) {
        try {
            sale.id = Date.now();
            sale.date = sale.saleDate || new Date().toISOString();
            
            // Update product quantity
            const product = this.getProduct(parseInt(sale.productId));
            if (product && product.quantity >= sale.quantity) {
                product.quantity -= sale.quantity;
                await this.updateProduct(product.id, { quantity: product.quantity });
                
                sale.productName = product.name;
                sale.totalAmount = sale.quantity * sale.price;
                
                // Save sale to Firebase
                await db.collection('sales').doc(sale.id.toString()).set(sale);
                this.sales.unshift(sale);
                
                return { success: true, sale };
            }
            return { success: false, message: 'Insufficient stock' };
        } catch (error) {
            console.error('Error recording sale:', error);
            return { success: false, message: 'Error recording sale. Please try again.' };
        }
    }

    // Add Transport Expense and distribute cost
    async addTransportExpense(transportData) {
        try {
            const expense = {
                id: Date.now(),
                date: transportData.date,
                amount: parseFloat(transportData.amount),
                billImage: transportData.billImage || '',
                timestamp: new Date().toISOString()
            };

            // Save to Firebase
            await db.collection('transportExpenses').doc(expense.id.toString()).set(expense);
            this.transportExpenses.unshift(expense);

            // Find products with matching purchase date
            const matchingProducts = this.products.filter(product => {
                if (!product.purchaseDate) return false;
                const productDate = new Date(product.purchaseDate).toDateString();
                const expenseDate = new Date(expense.date).toDateString();
                return productDate === expenseDate;
            });

            if (matchingProducts.length > 0) {
                // Calculate total stock quantity for matching products
                const totalStock = matchingProducts.reduce((sum, product) => sum + product.quantity, 0);

                // Distribute transport cost proportionally
                for (const product of matchingProducts) {
                    const transportCostPerProduct = (expense.amount * product.quantity) / totalStock;
                    const transportCostPerUnit = transportCostPerProduct / product.quantity;
                    
                    // Store transport cost separately without modifying the original price
                    const currentTransportCost = product.transportCost || 0;
                    const newTransportCost = currentTransportCost + transportCostPerUnit;
                    
                    await this.updateProduct(product.id, { 
                        transportCost: Math.round(newTransportCost * 100) / 100
                    });
                }

                return { 
                    success: true, 
                    expense,
                    productsUpdated: matchingProducts.length,
                    message: `Transport cost distributed across ${matchingProducts.length} product(s)`
                };
            }

            return { 
                success: true, 
                expense,
                productsUpdated: 0,
                message: 'Transport expense added. No matching products found for this date.'
            };
        } catch (error) {
            console.error('Error adding transport expense:', error);
            return { success: false, message: 'Error adding transport expense. Please try again.' };
        }
    }



    // Analytics
    getTodaySales() {
        const today = new Date().toDateString();
        return this.sales
            .filter(sale => new Date(sale.date).toDateString() === today)
            .reduce((sum, sale) => sum + sale.totalAmount, 0);
    }

    getWeekSales() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return this.sales
            .filter(sale => new Date(sale.date) >= weekAgo)
            .reduce((sum, sale) => sum + sale.totalAmount, 0);
    }

    getMonthSales() {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return this.sales
            .filter(sale => new Date(sale.date) >= firstDayOfMonth)
            .reduce((sum, sale) => sum + sale.totalAmount, 0);
    }

    getTotalStock() {
        return this.products.reduce((sum, product) => sum + product.quantity, 0);
    }

    getTotalSales() {
        return this.sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    }

    getTotalProducts() {
        return this.products.length;
    }

    getEstimatedRevenue() {
        // Calculate estimated revenue for all products in stock
        // Formula: ((Original Price + Transport Cost) + 90% profit + ₹100 labor) × Stock Quantity
        return this.products.reduce((sum, product) => {
            const originalPrice = parseFloat(product.originalPrice || product.price);
            const transportCost = parseFloat(product.transportCost || 0);
            const totalCostPrice = originalPrice + transportCost;
            const profitMargin = totalCostPrice * 0.90; // 90% profit
            const laborCharge = 100;
            const sellingPrice = totalCostPrice + profitMargin + laborCharge;
            const revenue = sellingPrice * product.quantity;
            return sum + revenue;
        }, 0);
    }

    getLowStockProducts(threshold = 10) {
        return this.products.filter(p => p.quantity < threshold);
    }

    getTopSellingProducts(limit = 5) {
        const salesByProduct = {};
        this.sales.forEach(sale => {
            if (!salesByProduct[sale.productId]) {
                salesByProduct[sale.productId] = {
                    productName: sale.productName,
                    quantity: 0,
                    revenue: 0
                };
            }
            salesByProduct[sale.productId].quantity += sale.quantity;
            salesByProduct[sale.productId].revenue += sale.totalAmount;
        });

        return Object.values(salesByProduct)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, limit);
    }
}

// Initialize the inventory manager
const inventory = new InventoryManager();

// ===================================
// UI RENDERING FUNCTIONS
// ===================================

function renderProducts(productsToRender = inventory.products) {
    const productGrid = document.getElementById('productGrid');
    
    // Products collection already contains only active products (quantity > 0)
    if (productsToRender.length === 0) {
        productGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>No products found</h3>
                <p>Add your first product to get started</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = productsToRender.map(product => `
        <div class="product-card fade-in" data-id="${product.id}">
            <div class="product-image">
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}" onerror="this.parentElement.innerHTML='👟'">` : 
                    '👟'
                }
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-details">
                    <span class="product-badge">${getCategoryName(product.category)}</span>
                    <span class="product-badge">Size: ${product.size}</span>
                    ${product.brand ? `<span class="product-badge">${product.brand}</span>` : ''}
                    ${product.color ? `<span class="product-badge">Color: ${product.color}</span>` : ''}
                </div>
                <div class="product-price">₹${(parseFloat(product.price) + parseFloat(product.transportCost || 0)).toLocaleString('en-IN')}</div>
                <div class="product-stock ${product.quantity < 10 ? 'stock-low' : 'stock-ok'}">
                    Stock: ${product.quantity} units
                </div>
                <div class="product-actions">
                    <button class="btn-icon btn-edit" onclick="editProduct(${product.id})">✏️ Edit</button>
                    <button class="btn-icon btn-delete" onclick="deleteProduct(${product.id})">🗑️ Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function getCategoryName(category) {
    const categories = {
        'men': 'Men',
        'women': 'Women'
    };
    return categories[category] || category;
}

function populateProductDropdowns() {
    const saleProductSelect = document.getElementById('saleProduct');
    
    const options = inventory.products.map(p => 
        `<option value="${p.id}">${p.name} (Size: ${p.size})</option>`
    ).join('');
    
    saleProductSelect.innerHTML = '<option value="">-- Choose a product --</option>' + options;
}

function renderRecentSales() {
    const recentSalesList = document.getElementById('recentSalesList');
    
    // Clear the container first
    recentSalesList.innerHTML = '';
    
    // Get sales from Firebase data only
    const recentSales = inventory.sales.slice(-10).reverse();
    
    if (recentSales.length === 0) {
        recentSalesList.innerHTML = '<p class="text-center">No sales recorded yet</p>';
        return;
    }

    recentSalesList.innerHTML = recentSales.map(sale => {
        const saleDate = sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('en-IN') : new Date(sale.date).toLocaleDateString('en-IN');
        const sizeInfo = sale.size ? ` - Size: ${sale.size}` : '';
        const colorInfo = sale.color ? ` - ${sale.color}` : '';
        return `
            <div class="transaction-item fade-in">
                <div class="transaction-header">
                    <span class="transaction-product">${sale.productName}${sizeInfo}${colorInfo}</span>
                    <span class="transaction-amount">₹${sale.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div class="transaction-details">
                    Qty: ${sale.quantity} | ${sale.paymentMode || sale.paymentMethod} | ${saleDate}
                </div>
            </div>
        `;
    }).join('');
}

function renderTransportExpenses() {
    const transportExpensesList = document.getElementById('transportExpensesList');
    
    // Clear the container first
    transportExpensesList.innerHTML = '';
    
    // Get transport expenses from Firebase data only
    const recentExpenses = inventory.transportExpenses.slice(0, 10);
    
    if (recentExpenses.length === 0) {
        transportExpensesList.innerHTML = '<p class="text-center">No transport expenses recorded yet</p>';
        return;
    }

    transportExpensesList.innerHTML = recentExpenses.map(expense => {
        const expenseDate = new Date(expense.date).toLocaleDateString('en-IN');
        const billImageHtml = expense.billImage ? 
            `<div style="margin-top: 0.5rem;">
                <a href="${expense.billImage}" target="_blank" style="color: var(--secondary-color); text-decoration: none;">
                    📄 View Bill Image
                </a>
            </div>` : '';
        
        return `
            <div class="transaction-item fade-in">
                <div class="transaction-header">
                    <span class="transaction-product">🚚 Transport Expense</span>
                    <span class="transaction-amount">₹${expense.amount.toLocaleString('en-IN')}</span>
                </div>
                <div class="transaction-details">
                    Date: ${expenseDate}
                    ${billImageHtml}
                </div>
            </div>
        `;
    }).join('');
}



function updateReports() {
    // Update statistics
    document.getElementById('todaySales').textContent = 
        '₹' + inventory.getTodaySales().toLocaleString('en-IN');
    document.getElementById('monthSales').textContent = 
        '₹' + inventory.getMonthSales().toLocaleString('en-IN');
    document.getElementById('totalStock').textContent = 
        inventory.getTotalStock().toLocaleString('en-IN');
    document.getElementById('totalSales').textContent = 
        '₹' + inventory.getTotalSales().toLocaleString('en-IN');
    document.getElementById('totalProducts').textContent = 
        inventory.getTotalProducts().toLocaleString('en-IN');
    document.getElementById('estimatedRevenue').textContent = 
        '₹' + Math.round(inventory.getEstimatedRevenue()).toLocaleString('en-IN');
}

// ===================================
// EVENT HANDLERS
// ===================================

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    try {
        // Initialize Firebase data
        const success = await inventory.initializeData();
        
        if (success) {
            // Initialize the app
            renderProducts();
            populateProductDropdowns();
            renderRecentSales();
            renderTransportExpenses();
            updateReports();
            
            // Hide loading overlay
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }, 500);
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        loadingOverlay.innerHTML = `
            <div style="text-align: center; color: #e6a400;">
                <h2>⚠️ Error Loading Data</h2>
                <p>Unable to connect to Firebase. Please check your connection and refresh.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.75rem 2rem; background: #e6a400; color: #004D4D; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">
                    Refresh Page
                </button>
            </div>
        `;
    }
});

// Smooth scrolling
function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', filterProducts);
document.getElementById('categoryFilter').addEventListener('change', filterProducts);

function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    const filtered = inventory.products.filter(product => {
        const matchesSearch = 
            product.name.toLowerCase().includes(searchTerm) ||
            product.size.toLowerCase().includes(searchTerm) ||
            product.brand.toLowerCase().includes(searchTerm) ||
            getCategoryName(product.category).toLowerCase().includes(searchTerm);
        
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    renderProducts(filtered);
}

// ===================================
// PRODUCT MODAL FUNCTIONS
// ===================================

const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const addProductBtn = document.getElementById('addProductBtn');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');

addProductBtn.addEventListener('click', () => {
    openProductModal();
});

closeModal.addEventListener('click', closeProductModal);
cancelBtn.addEventListener('click', closeProductModal);

// Close modal when clicking outside
productModal.addEventListener('click', (e) => {
    if (e.target === productModal) {
        closeProductModal();
    }
});

function openProductModal(productId = null) {
    productModal.classList.add('active');
    
    if (productId) {
        // Edit mode
        const product = inventory.getProduct(productId);
        document.getElementById('modalTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productSize').value = product.size;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productQuantity').value = product.quantity;
        document.getElementById('productBrand').value = product.brand || '';
        document.getElementById('productColor').value = product.color || '';
        document.getElementById('productPurchaseDate').value = product.purchaseDate || '';
        // Note: File input cannot be pre-filled for security reasons
    } else {
        // Add mode
        document.getElementById('modalTitle').textContent = 'Add New Product';
        productForm.reset();
        document.getElementById('productId').value = '';
        document.getElementById('productPurchaseDate').valueAsDate = new Date();
    }
}

function closeProductModal() {
    productModal.classList.remove('active');
    productForm.reset();
}

function editProduct(id) {
    openProductModal(id);
}

async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await inventory.deleteProduct(id);
            renderProducts();
            populateProductDropdowns();
            updateReports();
            showNotification('Product deleted successfully', 'success');
        } catch (error) {
            showNotification('Error deleting product. Please try again.', 'error');
        }
    }
}

// Product form submission
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const imageFile = document.getElementById('productImage').files[0];
    const productId = document.getElementById('productId').value;
    
    // Show loading notification
    showNotification('Saving product...', 'info');
    
    try {
        // Function to save product data
        const saveProduct = async (imageDataUrl) => {
            const originalPrice = parseFloat(document.getElementById('productPrice').value);
            const productData = {
                name: document.getElementById('productName').value.trim(),
                category: document.getElementById('productCategory').value,
                size: document.getElementById('productSize').value.trim(),
                price: originalPrice, // Keep original price (never changes)
                originalPrice: originalPrice, // Store original purchase price
                transportCost: 0, // Transport cost stored separately
                quantity: parseInt(document.getElementById('productQuantity').value),
                brand: document.getElementById('productBrand').value.trim(),
                color: document.getElementById('productColor').value.trim(),
                purchaseDate: document.getElementById('productPurchaseDate').value,
                image: imageDataUrl
            };
            
            if (productId) {
                // Update existing product
                await inventory.updateProduct(parseInt(productId), productData);
                showNotification('Product updated successfully', 'success');
            } else {
                // Add new product
                await inventory.addProduct(productData);
                showNotification('Product added successfully', 'success');
            }
            
            closeProductModal();
            renderProducts();
            populateProductDropdowns();
            updateReports();
        };
        
        // If image file is selected, convert to base64
        if (imageFile) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                await saveProduct(event.target.result);
            };
            reader.readAsDataURL(imageFile);
        } else {
            // If editing and no new image, keep existing image
            const existingImage = productId ? inventory.getProduct(parseInt(productId)).image : '';
            await saveProduct(existingImage || '');
        }
    } catch (error) {
        showNotification('Error saving product. Please try again.', 'error');
        console.error('Error saving product:', error);
    }
});

// ===================================
// SALES FORM HANDLING
// ===================================

const salesForm = document.getElementById('salesForm');

// Auto-fill price, stock, size, and color when product is selected
document.getElementById('saleProduct').addEventListener('change', (e) => {
    const productId = parseInt(e.target.value);
    const saleSize = document.getElementById('saleSize');
    const saleColor = document.getElementById('saleColor');
    
    if (productId) {
        const product = inventory.getProduct(productId);
        if (product) {
            // Calculate sale price: (Original Price + Transport Cost) + 90% profit + ₹100 labor
            const originalPrice = parseFloat(product.originalPrice || product.price);
            const transportCost = parseFloat(product.transportCost || 0);
            const totalCostPrice = originalPrice + transportCost;
            const profitMargin = totalCostPrice * 0.90; // 90% profit
            const laborCharge = 100;
            const salePrice = totalCostPrice + profitMargin + laborCharge;
            
            document.getElementById('salePrice').value = Math.round(salePrice * 100) / 100; // Round to 2 decimals
            document.getElementById('saleStock').value = product.quantity;
            
            // Populate size dropdown
            saleSize.innerHTML = '<option value="">-- Select Size --</option>';
            if (product.size) {
                const sizes = product.size.split(',').map(s => s.trim()).filter(s => s);
                sizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size;
                    option.textContent = size;
                    saleSize.appendChild(option);
                });
            }
            
            // Populate color dropdown
            saleColor.innerHTML = '<option value="">-- Select Color --</option>';
            if (product.color) {
                const colors = product.color.split(',').map(c => c.trim()).filter(c => c);
                colors.forEach(color => {
                    const option = document.createElement('option');
                    option.value = color;
                    option.textContent = color;
                    saleColor.appendChild(option);
                });
            }
        }
    } else {
        document.getElementById('saleStock').value = '';
        document.getElementById('salePrice').value = '';
        saleSize.innerHTML = '<option value="">-- Select Size --</option>';
        saleColor.innerHTML = '<option value="">-- Select Color --</option>';
    }
});

// Set today's date as default for sale date
document.getElementById('saleDate').valueAsDate = new Date();

salesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saleData = {
        productId: document.getElementById('saleProduct').value,
        size: document.getElementById('saleSize').value.trim(),
        color: document.getElementById('saleColor').value.trim(),
        quantity: parseInt(document.getElementById('saleQuantity').value),
        price: parseFloat(document.getElementById('salePrice').value),
        paymentMode: document.getElementById('paymentMode').value,
        saleDate: document.getElementById('saleDate').value
    };
    
    if (!saleData.productId) {
        showNotification('Please select a product', 'error');
        return;
    }
    
    showNotification('Recording sale...', 'info');
    const result = await inventory.recordSale(saleData);
    
    if (result.success) {
        showNotification('Sale recorded successfully', 'success');
        salesForm.reset();
        document.getElementById('saleStock').value = '';
        document.getElementById('saleSize').value = '';
        document.getElementById('saleColor').value = '';
        document.getElementById('saleDate').valueAsDate = new Date();
        renderProducts();
        renderRecentSales();
        populateProductDropdowns();
        updateReports();
    } else {
        showNotification(result.message, 'error');
    }
});

// Transport Expense Form
const transportExpenseForm = document.getElementById('transportExpenseForm');

// Set today's date as default for transport date
document.getElementById('transportDate').valueAsDate = new Date();

transportExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const billImageFile = document.getElementById('transportBillImage').files[0];
    
    showNotification('Adding transport expense...', 'info');
    
    try {
        // Function to save transport expense with image
        const saveTransportExpense = async (billImageUrl) => {
            const transportData = {
                date: document.getElementById('transportDate').value,
                amount: parseFloat(document.getElementById('transportAmount').value),
                billImage: billImageUrl
            };
            
            const result = await inventory.addTransportExpense(transportData);
            
            if (result.success) {
                showNotification(result.message, 'success');
                transportExpenseForm.reset();
                document.getElementById('transportDate').valueAsDate = new Date();
                renderTransportExpenses();
                renderProducts(); // Update products list to show new prices
                updateReports();
            } else {
                showNotification(result.message, 'error');
            }
        };
        
        // If bill image file is selected, convert to base64
        if (billImageFile) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                await saveTransportExpense(event.target.result);
            };
            reader.readAsDataURL(billImageFile);
        } else {
            // No image selected
            await saveTransportExpense('');
        }
    } catch (error) {
        showNotification('Error adding transport expense. Please try again.', 'error');
        console.error('Error adding transport expense:', error);
    }
});



// ===================================
// NOTIFICATION SYSTEM
// ===================================

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles inline for the notification
    notification.style.cssText = `
        position: fixed;
        top: 160px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 600;
        z-index: 3000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
    `;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#e6a400',
        info: '#004D4D'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add animation keyframes
    if (!document.querySelector('#notification-animation')) {
        const style = document.createElement('style');
        style.id = 'notification-animation';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===================================
// KEYBOARD SHORTCUTS
// ===================================

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // ESC to close modal
    if (e.key === 'Escape') {
        closeProductModal();
    }
});

// ===================================
// EXPORT/IMPORT FUNCTIONALITY (Optional)
// ===================================

function exportData() {
    const data = {
        products: inventory.products,
        sales: inventory.sales,
        purchases: inventory.purchases,
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Export all sales to PDF
function exportSalesToPDF() {
    if (inventory.sales.length === 0) {
        alert('No sales data to export');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 77, 77); // #004D4D
    doc.text('MULTI BRAND FOOTWEAR', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('All-Time Sales Report', 105, 23, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 105, 30, { align: 'center' });
    doc.text(`Total Sales: ${inventory.sales.length}`, 105, 36, { align: 'center' });
    
    // Table headers
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let yPos = 45;
    
    // Draw header background
    doc.setFillColor(0, 77, 77);
    doc.rect(10, yPos - 5, 190, 7, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.text('Product Name', 12, yPos);
    doc.text('Purchase Date', 65, yPos);
    doc.text('Sale Date', 95, yPos);
    doc.text('Color', 120, yPos);
    doc.text('Size', 145, yPos);
    doc.text('Month', 160, yPos);
    doc.text('Year', 182, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    yPos += 8;
    
    // Sort sales by date (most recent first)
    const sortedSales = [...inventory.sales].sort((a, b) => {
        const dateA = new Date(a.saleDate || a.date);
        const dateB = new Date(b.saleDate || b.date);
        return dateB - dateA;
    });
    
    // Add sales data
    sortedSales.forEach((sale, index) => {
        // Check if we need a new page
        if (yPos > 280) {
            doc.addPage();
            yPos = 20;
        }
        
        // Get product details
        const product = inventory.getProduct(sale.productId);
        const productName = sale.productName || (product ? product.name : 'Unknown');
        const purchaseDate = product && product.purchaseDate ? 
            new Date(product.purchaseDate).toLocaleDateString('en-IN') : 'N/A';
        
        // Sale date
        const saleDate = new Date(sale.saleDate || sale.date);
        const saleDateStr = saleDate.toLocaleDateString('en-IN');
        const month = saleDate.toLocaleString('en-IN', { month: 'short' });
        const year = saleDate.getFullYear();
        
        // Truncate long product names
        const truncatedName = productName.length > 25 ? 
            productName.substring(0, 22) + '...' : productName;
        
        // Alternate row colors
        if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(10, yPos - 4, 190, 6, 'F');
        }
        
        doc.setFontSize(8);
        doc.text(truncatedName, 12, yPos);
        doc.text(purchaseDate, 65, yPos);
        doc.text(saleDateStr, 95, yPos);
        doc.text(sale.color || 'N/A', 120, yPos);
        doc.text(sale.size || 'N/A', 145, yPos);
        doc.text(month, 160, yPos);
        doc.text(year.toString(), 182, yPos);
        
        yPos += 6;
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Save the PDF
    doc.save(`MultiBrandFootwear_Sales_${Date.now()}.pdf`);
}

// Event listener for PDF export button
document.getElementById('exportSalesPDF').addEventListener('click', exportSalesToPDF);

// ===================================
// CLEAR LOCAL STORAGE (ENSURE NO LOCAL DATA)
// ===================================
function clearAllLocalData() {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    console.log('✅ All local storage cleared. Data exists only in Firebase.');
}

// Clear any existing local storage on page load
clearAllLocalData();

// Console helper for debugging
console.log('%c Multi Brand Footwear - Inventory System ', 
    'background: #004D4D; color: #e6a400; font-size: 16px; padding: 10px; border-radius: 5px;');
console.log('💡 All data is stored in Firebase Firestore ONLY');
console.log('🚫 No local storage or cache is used');
console.log('📊 Access inventory object: window.inventory');
console.log('🔥 Firebase initialized successfully');

// Make inventory accessible in console for debugging
window.inventory = inventory;

// ===================================
// 3D CHARTS INITIALIZATION
// ===================================

let charts3D = {
    salesTrend: null,
    categoryDistribution: null,
    topProducts: null,
    paymentMode: null,
    monthlyRevenue: null,
    stockStatus: null
};

function initialize3DCharts() {
    // Configure Chart.js defaults for 3D effect
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
    
    initSalesTrend3D();
    initCategoryDistribution3D();
    initTopProducts3D();
    initPaymentMode3D();
    initMonthlyRevenue3D();
    initStockStatus3D();
    
    // Update charts with actual data
    update3DChartsData();
}

function initSalesTrend3D() {
    const ctx = document.getElementById('salesTrend3D');
    if (!ctx) return;
    
    charts3D.salesTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Sales (₹)',
                data: [],
                backgroundColor: createGradient(ctx, '#004D4D', '#e6a400'),
                borderColor: '#004D4D',
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 77, 77, 0.9)',
                    titleColor: '#e6a400',
                    bodyColor: '#ffffff',
                    borderColor: '#e6a400',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `₹${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 77, 77, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: (value) => '₹' + value.toLocaleString()
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function initCategoryDistribution3D() {
    const ctx = document.getElementById('categoryDistribution3D');
    if (!ctx) return;
    
    charts3D.categoryDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Men', 'Women'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [
                    'rgba(0, 77, 77, 0.8)',
                    'rgba(230, 164, 0, 0.8)'
                ],
                borderColor: [
                    '#004D4D',
                    '#e6a400'
                ],
                borderWidth: 3,
                hoverOffset: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 77, 77, 0.9)',
                    titleColor: '#e6a400',
                    bodyColor: '#ffffff',
                    borderColor: '#e6a400',
                    borderWidth: 2,
                    padding: 12,
                    callbacks: {
                        label: (context) => `${context.label}: ${context.parsed} units`
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 2000
            }
        }
    });
}

function initTopProducts3D() {
    const ctx = document.getElementById('topProducts3D');
    if (!ctx) return;
    
    charts3D.topProducts = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue (₹)',
                data: [],
                backgroundColor: createGradient(ctx, '#e6a400', '#004D4D'),
                borderColor: '#e6a400',
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(230, 164, 0, 0.9)',
                    titleColor: '#004D4D',
                    bodyColor: '#ffffff',
                    borderColor: '#004D4D',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `₹${context.parsed.x.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(230, 164, 0, 0.1)'
                    },
                    ticks: {
                        callback: (value) => '₹' + value.toLocaleString()
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function initPaymentMode3D() {
    const ctx = document.getElementById('paymentMode3D');
    if (!ctx) return;
    
    charts3D.paymentMode = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: ['Cash', 'UPI'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [
                    'rgba(0, 77, 77, 0.7)',
                    'rgba(230, 164, 0, 0.7)'
                ],
                borderColor: [
                    '#004D4D',
                    '#e6a400'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 77, 77, 0.9)',
                    titleColor: '#e6a400',
                    bodyColor: '#ffffff',
                    borderColor: '#e6a400',
                    borderWidth: 2,
                    padding: 12,
                    callbacks: {
                        label: (context) => `${context.label}: ₹${context.parsed.toLocaleString()}`
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 77, 77, 0.1)'
                    },
                    ticks: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                animateRotate: true,
                animateScale: true
            }
        }
    });
}

function initMonthlyRevenue3D() {
    const ctx = document.getElementById('monthlyRevenue3D');
    if (!ctx) return;
    
    charts3D.monthlyRevenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue',
                data: [],
                backgroundColor: 'rgba(0, 77, 77, 0.1)',
                borderColor: '#004D4D',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#e6a400',
                pointBorderColor: '#004D4D',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 77, 77, 0.9)',
                    titleColor: '#e6a400',
                    bodyColor: '#ffffff',
                    borderColor: '#e6a400',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `₹${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 77, 77, 0.1)'
                    },
                    ticks: {
                        callback: (value) => '₹' + (value / 1000) + 'K'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function initStockStatus3D() {
    const ctx = document.getElementById('stockStatus3D');
    if (!ctx) return;
    
    charts3D.stockStatus = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['In Stock (>10)', 'Low Stock (1-10)', 'Out of Stock (0)'],
            datasets: [{
                label: 'Products',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(230, 164, 0, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    '#10b981',
                    '#e6a400',
                    '#ef4444'
                ],
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 77, 77, 0.9)',
                    titleColor: '#e6a400',
                    bodyColor: '#ffffff',
                    borderColor: '#e6a400',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `${context.parsed.y} products`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 77, 77, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function createGradient(ctx, color1, color2) {
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

function update3DChartsData() {
    updateSalesTrendData();
    updateCategoryDistributionData();
    updateTopProductsData();
    updatePaymentModeData();
    updateMonthlyRevenueData();
    updateStockStatusData();
}

function updateSalesTrendData() {
    const last7Days = [];
    const salesByDay = {};
    
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
        salesByDay[dateStr] = 0;
    }
    
    // Calculate sales for each day
    inventory.sales.forEach(sale => {
        const saleDate = sale.date;
        if (salesByDay.hasOwnProperty(saleDate)) {
            salesByDay[saleDate] += sale.totalPrice;
        }
    });
    
    const salesData = last7Days.map(date => salesByDay[date]);
    const labels = last7Days.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    
    if (charts3D.salesTrend) {
        charts3D.salesTrend.data.labels = labels;
        charts3D.salesTrend.data.datasets[0].data = salesData;
        charts3D.salesTrend.update();
    }
    
    // Update stats
    const avgDaily = salesData.reduce((a, b) => a + b, 0) / 7;
    const maxSale = Math.max(...salesData);
    const peakDayIndex = salesData.indexOf(maxSale);
    
    document.getElementById('avgDailySales').textContent = '₹' + avgDaily.toFixed(0);
    document.getElementById('peakDay').textContent = labels[peakDayIndex] || '-';
}

function updateCategoryDistributionData() {
    let menStock = 0;
    let womenStock = 0;
    
    inventory.products.forEach(product => {
        if (product.category === 'men') {
            menStock += product.quantity;
        } else if (product.category === 'women') {
            womenStock += product.quantity;
        }
    });
    
    if (charts3D.categoryDistribution) {
        charts3D.categoryDistribution.data.datasets[0].data = [menStock, womenStock];
        charts3D.categoryDistribution.update();
    }
    
    document.getElementById('menStock').textContent = menStock;
    document.getElementById('womenStock').textContent = womenStock;
}

function updateTopProductsData() {
    const productRevenue = {};
    
    inventory.sales.forEach(sale => {
        const productName = sale.productName || 'Unknown';
        if (!productRevenue[productName]) {
            productRevenue[productName] = 0;
        }
        productRevenue[productName] += sale.totalPrice;
    });
    
    const sortedProducts = Object.entries(productRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const labels = sortedProducts.map(p => p[0]);
    const data = sortedProducts.map(p => p[1]);
    
    if (charts3D.topProducts) {
        charts3D.topProducts.data.labels = labels;
        charts3D.topProducts.data.datasets[0].data = data;
        charts3D.topProducts.update();
    }
    
    if (sortedProducts.length > 0) {
        document.getElementById('bestSeller').textContent = sortedProducts[0][0];
        document.getElementById('bestSellerRevenue').textContent = '₹' + sortedProducts[0][1].toLocaleString();
    }
}

function updatePaymentModeData() {
    let cashTotal = 0;
    let upiTotal = 0;
    
    inventory.sales.forEach(sale => {
        if (sale.paymentMode === 'Cash') {
            cashTotal += sale.totalPrice;
        } else if (sale.paymentMode === 'UPI') {
            upiTotal += sale.totalPrice;
        }
    });
    
    if (charts3D.paymentMode) {
        charts3D.paymentMode.data.datasets[0].data = [cashTotal, upiTotal];
        charts3D.paymentMode.update();
    }
    
    document.getElementById('cashPayments').textContent = '₹' + cashTotal.toLocaleString();
    document.getElementById('upiPayments').textContent = '₹' + upiTotal.toLocaleString();
}

function updateMonthlyRevenueData() {
    const last6Months = [];
    const revenueByMonth = {};
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().substring(0, 7); // YYYY-MM
        last6Months.push(monthStr);
        revenueByMonth[monthStr] = 0;
    }
    
    // Calculate revenue for each month
    inventory.sales.forEach(sale => {
        const saleMonth = sale.date.substring(0, 7);
        if (revenueByMonth.hasOwnProperty(saleMonth)) {
            revenueByMonth[saleMonth] += sale.totalPrice;
        }
    });
    
    const revenueData = last6Months.map(month => revenueByMonth[month]);
    const labels = last6Months.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    if (charts3D.monthlyRevenue) {
        charts3D.monthlyRevenue.data.labels = labels;
        charts3D.monthlyRevenue.data.datasets[0].data = revenueData;
        charts3D.monthlyRevenue.update();
    }
    
    // Update stats
    const currentMonth = revenueData[revenueData.length - 1];
    const lastMonth = revenueData[revenueData.length - 2];
    const growth = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0;
    
    document.getElementById('currentMonthRev').textContent = '₹' + currentMonth.toLocaleString();
    document.getElementById('lastMonthRev').textContent = '₹' + lastMonth.toLocaleString();
    document.getElementById('growthRate').textContent = (growth >= 0 ? '+' : '') + growth + '%';
}

function updateStockStatusData() {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    
    inventory.products.forEach(product => {
        if (product.quantity === 0) {
            outOfStock++;
        } else if (product.quantity <= 10) {
            lowStock++;
        } else {
            inStock++;
        }
    });
    
    if (charts3D.stockStatus) {
        charts3D.stockStatus.data.datasets[0].data = [inStock, lowStock, outOfStock];
        charts3D.stockStatus.update();
    }
    
    document.getElementById('inStockCount').textContent = inStock;
    document.getElementById('lowStockCount').textContent = lowStock;
    document.getElementById('outOfStockCount').textContent = outOfStock;
}

// Initialize 3D charts after data is loaded
window.addEventListener('load', () => {
    setTimeout(() => {
        initialize3DCharts();
    }, 1500);
});
