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

// ===================================
// DATA & PAGINATION STATE
// ===================================
let allProducts = [];
let currentPage = 1;
let itemsPerPage = 25;
let totalPages = 1;

// ===================================
// LOAD PRODUCTS FROM FIREBASE
// ===================================
async function loadProducts() {
    try {
        // Load from productHistory to show all products including zero stock
        const productsSnapshot = await db.collection('productHistory').get();
        allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort by purchase date (most recent first), then by name
        allProducts.sort((a, b) => {
            const dateA = a.purchaseDate ? new Date(a.purchaseDate) : new Date(0);
            const dateB = b.purchaseDate ? new Date(b.purchaseDate) : new Date(0);
            
            if (dateB.getTime() !== dateA.getTime()) {
                return dateB - dateA;
            }
            return a.name.localeCompare(b.name);
        });
        
        updateTotalProducts();
        calculatePages();
        renderTable();
        
        return true;
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Error loading products. Please refresh the page.');
        return false;
    }
}

// ===================================
// PAGINATION FUNCTIONS
// ===================================
function calculatePages() {
    totalPages = Math.ceil(allProducts.length / itemsPerPage);
    if (totalPages === 0) totalPages = 1;
}

function getCurrentPageProducts() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return allProducts.slice(startIndex, endIndex);
}

function updatePaginationControls() {
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const firstBtn = document.getElementById('firstPage');
    const lastBtn = document.getElementById('lastPage');
    
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevBtn.disabled = currentPage === 1;
    firstBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    lastBtn.disabled = currentPage === totalPages;
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function goToPage(pageNumber) {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
        currentPage = pageNumber;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function goToLastPage() {
    currentPage = totalPages;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changeItemsPerPage() {
    itemsPerPage = parseInt(document.getElementById('itemsPerPage').value);
    currentPage = 1;
    calculatePages();
    renderTable();
}

// ===================================
// RENDER TABLE
// ===================================
function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const pageProducts = getCurrentPageProducts();
    
    if (pageProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <h3>No products found</h3>
                    <p>Add products from the dashboard to see them here.</p>
                </td>
            </tr>
        `;
        updatePaginationControls();
        return;
    }
    
    const startSerialNumber = (currentPage - 1) * itemsPerPage + 1;
    
    tableBody.innerHTML = pageProducts.map((product, index) => {
        const serialNumber = startSerialNumber + index;
        const purchaseDate = product.purchaseDate ? 
            new Date(product.purchaseDate).toLocaleDateString('en-IN') : 'N/A';
        const category = getCategoryName(product.category);
        const categoryClass = product.category === 'men' ? 'category-men' : 'category-women';
        
        return `
            <tr>
                <td>${purchaseDate}</td>
                <td>${serialNumber}</td>
                <td>${product.name}</td>
                <td><span class="category-badge ${categoryClass}">${category}</span></td>
                <td>${product.brand || 'N/A'}</td>
                <td>${product.size || 'N/A'}</td>
                <td>${product.color || 'N/A'}</td>
                <td>₹${product.price.toLocaleString('en-IN')}</td>
                <td>${product.quantity}</td>
                <td>
                    ${product.image ? 
                        `<img src="${product.image}" alt="${product.name}" class="product-image">` :
                        `<div class="no-image">No Image</div>`
                    }
                </td>
            </tr>
        `;
    }).join('');
    
    updatePaginationControls();
}

// ===================================
// HELPER FUNCTIONS
// ===================================
function getCategoryName(category) {
    const categories = {
        'men': 'Men',
        'women': 'Women'
    };
    return categories[category] || category;
}

function updateTotalProducts() {
    document.getElementById('totalProducts').textContent = `Total Products: ${allProducts.length}`;
}

function showError(message) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="10" class="empty-state">
                <h3>⚠️ Error</h3>
                <p>${message}</p>
            </td>
        </tr>
    `;
}

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

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async function() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Clear any local storage
    clearAllLocalData();
    
    try {
        const success = await loadProducts();
        
        if (success) {
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }, 500);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        loadingOverlay.innerHTML = `
            <div style="text-align: center; color: white;">
                <h2>⚠️ Error Loading Data</h2>
                <p>Please refresh the page to try again.</p>
            </div>
        `;
    }
});

console.log('%c Multi Brand Footwear - Products Table ', 
    'background: #004D4D; color: #e6a400; font-size: 16px; padding: 10px; border-radius: 5px;');
console.log('📊 All products loaded from Firebase ONLY');
console.log('🚫 No local storage or cache is used');
