class MyToolsApp {
    constructor() {
        this.shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || [];
        this.currentEditId = null;
        this.initElements();
        this.initEventListeners();
        this.initSortable();
        this.renderShortcuts();
    }

    // === Initialization Methods ===
    initElements() {
        this.grid = document.getElementById('shortcuts-grid');
        this.modal = document.getElementById('shortcut-modal');
        this.form = document.getElementById('shortcut-form');
        this.addButton = document.getElementById('add-shortcut-fab');
        this.modalCancelButton = document.getElementById('modal-cancel');
        this.nameInput = document.getElementById('shortcut-name');
        this.urlInput = document.getElementById('shortcut-url');
        this.initTabSystem();
        this.initBulkImport();
    }

    initEventListeners() {
        this.addButton.addEventListener('click', () => this.openModal());
        this.modalCancelButton.addEventListener('click', () => this.closeModal());
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
    }

    initSortable() {
        new Sortable(this.grid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: () => {
                // Update order in shortcuts array
                const tiles = Array.from(this.grid.children);
                this.shortcuts = tiles.map(tile => 
                    this.shortcuts.find(s => s.id === tile.dataset.id)
                );
                this.saveToLocalStorage();
            }
        });
    }

    // === Tab System Methods ===
    initTabSystem() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-form`);
        });
    }

    // === Bulk Import Methods ===
    initBulkImport() {
        const bulkForm = document.getElementById('bulk-shortcut-form');
        const bulkUrls = document.getElementById('bulk-urls');
        const bulkPreview = document.getElementById('bulk-preview');
        const bulkCancelBtn = document.getElementById('bulk-modal-cancel');

        bulkForm.addEventListener('submit', (e) => this.handleBulkSubmit(e));
        bulkCancelBtn.addEventListener('click', () => this.closeModal());
        
        // Live preview as user types/pastes
        bulkUrls.addEventListener('input', debounce(() => {
            this.updateBulkPreview(bulkUrls.value);
        }, 500));
    }

    async updateBulkPreview(urlsText) {
        const urls = this.parseUrls(urlsText);
        const preview = document.getElementById('bulk-preview');
        preview.innerHTML = '';

        for (const url of urls) {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <img src="https://www.google.com/s2/favicons?sz=64&domain=${new URL(url).hostname}" alt="icon">
                <div class="preview-item-details">
                    <div>Loading...</div>
                    <div class="preview-item-url">${url}</div>
                </div>
                <div class="preview-item-status">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            `;
            preview.appendChild(previewItem);

            // Fetch metadata
            try {
                const metadata = await this.fetchUrlMetadata(url);
                previewItem.querySelector('.preview-item-details div:first-child').textContent = metadata.title;
                previewItem.querySelector('.preview-item-status').innerHTML = 
                    '<i class="fas fa-check status-success"></i>';
            } catch (error) {
                previewItem.querySelector('.preview-item-status').innerHTML = 
                    '<i class="fas fa-exclamation-circle status-error"></i>';
            }
        }
    }

    async handleBulkSubmit(e) {
        e.preventDefault();
        const urlsText = document.getElementById('bulk-urls').value;
        const urls = this.parseUrls(urlsText);
        const saveButton = document.getElementById('bulk-modal-save');
        const spinner = saveButton.querySelector('.spinner');

        if (urls.length === 0) {
            alert('Please enter at least one valid URL');
            return;
        }

        spinner.classList.remove('hidden');
        saveButton.disabled = true;

        try {
            for (const url of urls) {
                const metadata = await this.fetchUrlMetadata(url);
                const shortcut = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: metadata.title,
                    url: url,
                    icon: await this.getFavicon(url)
                };
                this.shortcuts.push(shortcut);
            }

            this.saveToLocalStorage();
            this.renderShortcuts();
            this.closeModal();
        } catch (error) {
            console.error('Error processing URLs:', error);
            alert('There was an error processing some URLs. Please try again.');
        } finally {
            spinner.classList.add('hidden');
            saveButton.disabled = false;
        }
    }

    // === Utility Methods ===
    parseUrls(text) {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
                try {
                    new URL(line);
                    return true;
                } catch {
                    return false;
                }
            });
    }

    async fetchUrlMetadata(url) {
        try {
            // First, try using the fetch API directly
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const title = doc.querySelector('title')?.textContent ||
                         doc.querySelector('meta[property="og:title"]')?.content ||
                         doc.querySelector('meta[name="twitter:title"]')?.content ||
                         new URL(url).hostname;

            return {
                title: title.trim(),
                url: url
            };
        } catch (error) {
            // If direct fetch fails (due to CORS), fallback to using the hostname
            const hostname = new URL(url).hostname;
            return {
                title: hostname.replace(/^www\./, ''),
                url: url
            };
        }
    }

    async getFavicon(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
        } catch {
            return 'https://via.placeholder.com/48?text=🔗';
        }
    }

    // === Modal Methods ===
    openModal(shortcut = null) {
        this.currentEditId = shortcut ? shortcut.id : null;
        document.getElementById('modal-title').textContent = 
            shortcut ? 'Edit Shortcut' : 'Add New Shortcut';
        
        this.nameInput.value = shortcut ? shortcut.name : '';
        this.urlInput.value = shortcut ? shortcut.url : '';
        
        this.modal.classList.add('active');
        this.nameInput.focus();
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.form.reset();
        this.currentEditId = null;
    }

    // === Shortcut Management Methods ===
    async handleFormSubmit(e) {
        e.preventDefault();
        
        const shortcut = {
            id: this.currentEditId || Date.now().toString(),
            name: this.nameInput.value.trim(),
            url: this.urlInput.value.trim(),
            icon: await this.getFavicon(this.urlInput.value)
        };

        if (this.currentEditId) {
            const index = this.shortcuts.findIndex(s => s.id === this.currentEditId);
            this.shortcuts[index] = shortcut;
        } else {
            this.shortcuts.push(shortcut);
        }

        this.saveToLocalStorage();
        this.renderShortcuts();
        this.closeModal();
    }

    createShortcutTile(shortcut) {
        const tile = document.createElement('div');
        tile.className = 'shortcut-tile';
        tile.dataset.id = shortcut.id;
        
        tile.innerHTML = `
            <img src="${shortcut.icon}" alt="${shortcut.name}" class="shortcut-icon">
            <h3 class="shortcut-name">${shortcut.name}</h3>
            <div class="shortcut-menu">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        // Add click event to open URL
        tile.addEventListener('click', (e) => {
            if (!e.target.closest('.shortcut-menu')) {
                window.open(shortcut.url, '_blank');
            }
        });

        // Add context menu
        const menu = tile.querySelector('.shortcut-menu');
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showContextMenu(e, shortcut);
        });

        return tile;
    }

    showContextMenu(event, shortcut) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '1000';
        menu.style.background = 'white';
        menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        menu.style.borderRadius = '4px';
        menu.style.padding = '0.5rem 0';

        const options = [
            { text: 'Edit', icon: 'edit', action: () => this.openModal(shortcut) },
            { text: 'Delete', icon: 'trash-alt', action: () => this.deleteShortcut(shortcut.id) }
        ];

        options.forEach(({ text, icon, action }) => {
            const option = document.createElement('div');
            option.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
            option.style.padding = '0.5rem 1rem';
            option.style.cursor = 'pointer';
            option.addEventListener('click', () => {
                action();
                document.body.removeChild(menu);
            });
            option.addEventListener('mouseover', () => {
                option.style.background = '#f0f0f0';
            });
            option.addEventListener('mouseout', () => {
                option.style.background = 'white';
            });
            menu.appendChild(option);
        });

        // Position the menu
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        // Add to body and handle outside clicks
        document.body.appendChild(menu);
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    deleteShortcut(id) {
        if (confirm('Are you sure you want to delete this shortcut?')) {
            this.shortcuts = this.shortcuts.filter(s => s.id !== id);
            this.saveToLocalStorage();
            this.renderShortcuts();
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('shortcuts', JSON.stringify(this.shortcuts));
    }

    renderShortcuts() {
        this.grid.innerHTML = '';
        this.shortcuts.forEach(shortcut => {
            this.grid.appendChild(this.createShortcutTile(shortcut));
        });
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new MyToolsApp();
});