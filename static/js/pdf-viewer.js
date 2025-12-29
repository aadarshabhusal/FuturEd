// FuturEd - PDF Viewer Module

const PDFViewer = (function() {
    let pdfDoc = null;
    let currentPage = 1;
    let currentScale = 1.0;
    let totalPages = 0;
    let isRendering = false;
    let pendingRender = null;
    
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 3.0;
    const SCALE_STEP = 0.25;

    // DOM Elements
    const elements = {
        viewer: null,
        loading: null,
        error: null,
        errorMessage: null,
        currentPageEl: null,
        totalPagesEl: null,
        zoomLevel: null,
        container: null
    };

    function init() {
        // Cache DOM elements
        elements.viewer = document.getElementById('pdf-viewer');
        elements.loading = document.getElementById('pdf-loading');
        elements.error = document.getElementById('pdf-error');
        elements.errorMessage = document.getElementById('pdf-error-message');
        elements.currentPageEl = document.getElementById('current-page');
        elements.totalPagesEl = document.getElementById('total-pages');
        elements.zoomLevel = document.getElementById('zoom-level');
        elements.container = document.getElementById('pdf-container');

        // Set up PDF. js worker
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Bind event listeners
        bindEvents();

        // Load the PDF
        loadPDF(PDF_URL);
    }

    function bindEvents() {
        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', zoomIn);
        document.getElementById('zoom-out')?.addEventListener('click', zoomOut);
        document.getElementById('zoom-fit')?.addEventListener('click', zoomFit);

        // Page navigation
        document.getElementById('prev-page')?.addEventListener('click', prevPage);
        document.getElementById('next-page')?.addEventListener('click', nextPage);

        // Retry button
        document.getElementById('retry-pdf')?.addEventListener('click', () => loadPDF(PDF_URL));

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Scroll to track current page
        elements.container?. addEventListener('scroll', handleScroll);
    }

    async function loadPDF(url) {
        showLoading();
        
        try {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfDoc = await pdfjsLib.getDocument(url).promise;
            totalPages = pdfDoc.numPages;
            
            updatePageInfo();
            await renderAllPages();
            hideLoading();
        } catch (error) {
            console.error('Error loading PDF:', error);
            showError(error.message || 'Failed to load PDF document');
        }
    }

    async function renderAllPages() {
        if (! pdfDoc || isRendering) return;
        
        isRendering = true;
        elements.viewer.innerHTML = '';

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: currentScale });

                // Create page wrapper
                const pageWrapper = document.createElement('div');
                pageWrapper.className = 'page-wrapper';
                pageWrapper.dataset.pageNumber = pageNum;

                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Create page number label
                const pageLabel = document.createElement('div');
                pageLabel.className = 'page-number';
                pageLabel.textContent = `Page ${pageNum}`;

                pageWrapper.appendChild(canvas);
                pageWrapper.appendChild(pageLabel);
                elements.viewer.appendChild(pageWrapper);

                // Render page
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

            } catch (error) {
                console.error(`Error rendering page ${pageNum}: `, error);
            }
        }

        isRendering = false;
    }

    async function renderSinglePage(pageNum) {
        if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;

        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale:  currentScale });

            const pageWrapper = elements.viewer.querySelector(`[data-page-number="${pageNum}"]`);
            if (!pageWrapper) return;

            const canvas = pageWrapper.querySelector('canvas');
            if (!canvas) return;

            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

        } catch (error) {
            console.error(`Error rendering page ${pageNum}:`, error);
        }
    }

    function zoomIn() {
        if (currentScale < MAX_SCALE) {
            currentScale = Math.min(currentScale + SCALE_STEP, MAX_SCALE);
            updateZoom();
        }
    }

    function zoomOut() {
        if (currentScale > MIN_SCALE) {
            currentScale = Math.max(currentScale - SCALE_STEP, MIN_SCALE);
            updateZoom();
        }
    }

    function zoomFit() {
        if (! pdfDoc || !elements.container) return;

        // Calculate scale to fit width
        pdfDoc.getPage(1).then(page => {
            const containerWidth = elements.container.clientWidth - 40; // Subtract padding
            const viewport = page.getViewport({ scale: 1.0 });
            currentScale = containerWidth / viewport.width;
            currentScale = Math.max(MIN_SCALE, Math.min(currentScale, MAX_SCALE));
            updateZoom();
        });
    }

    function updateZoom() {
        elements.zoomLevel.textContent = Math.round(currentScale * 100) + '%';
        renderAllPages();
    }

    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
            scrollToPage(currentPage);
            updatePageInfo();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            scrollToPage(currentPage);
            updatePageInfo();
        }
    }

    function scrollToPage(pageNum) {
        const pageWrapper = elements.viewer.querySelector(`[data-page-number="${pageNum}"]`);
        if (pageWrapper) {
            pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function handleScroll() {
        // Determine which page is currently most visible
        const pageWrappers = elements.viewer.querySelectorAll('.page-wrapper');
        const containerRect = elements.container.getBoundingClientRect();
        const containerMiddle = containerRect.top + containerRect.height / 2;

        let closestPage = 1;
        let closestDistance = Infinity;

        pageWrappers.forEach((wrapper, index) => {
            const rect = wrapper.getBoundingClientRect();
            const pageMiddle = rect.top + rect.height / 2;
            const distance = Math.abs(pageMiddle - containerMiddle);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPage = index + 1;
            }
        });

        if (closestPage !== currentPage) {
            currentPage = closestPage;
            updatePageInfo();
        }
    }

    function handleKeyboard(e) {
        // Only handle if PDF viewer is in focus area
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowUp':
            case 'PageUp':
                if (e.ctrlKey) {
                    e.preventDefault();
                    prevPage();
                }
                break;
            case 'ArrowDown':
            case 'PageDown':
                if (e.ctrlKey) {
                    e.preventDefault();
                    nextPage();
                }
                break;
            case '+':
            case '=':
                if (e.ctrlKey) {
                    e.preventDefault();
                    zoomIn();
                }
                break;
            case '-': 
                if (e.ctrlKey) {
                    e.preventDefault();
                    zoomOut();
                }
                break;
            case '0':
                if (e.ctrlKey) {
                    e.preventDefault();
                    zoomFit();
                }
                break;
        }
    }

    function updatePageInfo() {
        if (elements.currentPageEl) elements.currentPageEl.textContent = currentPage;
        if (elements.totalPagesEl) elements.totalPagesEl.textContent = totalPages;

        // Update button states
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }

    function showLoading() {
        if (elements.loading) elements.loading.classList.remove('hidden');
        if (elements.error) elements.error.classList.add('hidden');
        if (elements.viewer) elements.viewer.innerHTML = '';
    }

    function hideLoading() {
        if (elements.loading) elements.loading.classList.add('hidden');
    }

    function showError(message) {
        if (elements.loading) elements.loading.classList.add('hidden');
        if (elements.error) elements.error.classList. remove('hidden');
        if (elements.errorMessage) elements.errorMessage.textContent = message;
    }

    // Public API
    return {
        init:  init,
        zoomIn: zoomIn,
        zoomOut: zoomOut,
        zoomFit: zoomFit,
        goToPage: scrollToPage,
        getCurrentPage: () => currentPage,
        getTotalPages: () => totalPages,
        getScale: () => currentScale
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof PDF_URL !== 'undefined') {
        PDFViewer.init();
    }
});