// DOM元素引用
let searchEngineSelect, mainSearchInput, mainSearchBtn;

// 执行搜索功能
function performMainSearch() {
    try {
        const query = mainSearchInput.value.trim();
        if (!query) return;
        
        const engine = searchEngineSelect.value;
        let searchUrl = '';
        
        switch (engine) {
            case 'baidu':
                searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
                break;
            case '360':
                searchUrl = `https://www.so.com/s?q=${encodeURIComponent(query)}`;
                break;
            default:
                searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
        }
        
        window.open(searchUrl, '_blank');
    } catch (error) {
        console.error('搜索执行出错:', error);
    }
}



// 初始化页面功能
function initPage() {
    try {
        // 获取搜索引擎相关元素
        searchEngineSelect = document.getElementById('searchEngineSelect');
        mainSearchInput = document.getElementById('mainSearchInput');
        mainSearchBtn = document.getElementById('mainSearchBtn');
        
        // 绑定搜索按钮点击事件
        if (mainSearchBtn) {
            mainSearchBtn.addEventListener('click', performMainSearch);
        }
        
        // 绑定搜索框回车事件
        if (mainSearchInput) {
            mainSearchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    performMainSearch();
                }
            });
        }
        
        // 设置键盘快捷键 - Ctrl+K 聚焦搜索框
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (mainSearchInput) {
                    mainSearchInput.focus();
                }
            }
        });
        
        // "更多+"链接功能
        const categoryTitles = document.querySelectorAll('.category-title');
        
        // 定义各分类对应的更多网站链接
        const categoryLinks = {
            'design-materials': 'https://www.baidu.com/s?wd=设计素材网站集合',
            'ai-design': 'https://www.baidu.com/s?wd=AI设计工具合集',
            'e-commerce': 'https://www.baidu.com/s?wd=电商网站大全',
            'common-sites': 'https://www.baidu.com/s?wd=常用网站推荐'
        };
        
        categoryTitles.forEach(title => {
            // 找到父级分类元素以获取ID
            const categoryElement = title.closest('.category');
            const categoryId = categoryElement ? categoryElement.id : '';
            
            // 创建点击事件委托，只在点击"更多+"时触发
            title.addEventListener('click', function(e) {
                // 检查点击位置是否在标题末尾（假设是"更多+"区域）
                // 或者如果整个标题被点击，我们认为用户是想查看更多
                const targetUrl = categoryId && categoryLinks[categoryId] ? categoryLinks[categoryId] : 'https://www.baidu.com';
                window.open(targetUrl, '_blank');
            });
        });
        
   } catch (error) {
        console.error('初始化页面出错:', error);
    }
}

// 平滑滚动
if (document.querySelectorAll('a[href^="#"]').length > 0) {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId !== '#' && document.querySelector(targetId)) {
                document.querySelector(targetId).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', () => {
    initPage();
});
