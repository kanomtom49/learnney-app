(function() {
    // ##################################################################
    // ###########           CLASS AND CORE LOGIC           ###########
    // ##################################################################
    class StudyService {
        constructor() {
            this.FSRS_PARAMS = { request_retention: 0.9, w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61] };
            this.DECAY = -0.5;
            this.FACTOR = (Math.pow(this.FSRS_PARAMS.request_retention, 1 / this.DECAY) - 1);
            this.subjects = [];
            this.topics = [];
        }
        async #fetchAPI(endpoint, options = {}) {
            const user = window.netlifyIdentity.currentUser();
            const headers = { 'Content-Type': 'application/json', ...options.headers };
            if (user && user.token) { headers['Authorization'] = `Bearer ${user.token.access_token}`; }
            const response = await fetch(`/.netlify/functions/data${endpoint}`, { ...options, headers });
            if (!response.ok) { const errorData = await response.json().catch(() => ({error: `Server error: ${response.statusText}`})); throw new Error(errorData.error); }
            if (response.status === 204) return null;
            return response.json();
        }
        async loadDataFromServer() {
            try {
                const data = await this.#fetchAPI('');
                this.subjects = data.subjects || [];
                this.topics = (data.topics || []).map(topic => ({
                    ...topic, id: Number(topic.id), subjectId: Number(topic.subject_id),
                    nextReview: topic.next_review ? new Date(topic.next_review) : null, lastReview: topic.last_review ? new Date(topic.last_review) : null,
                    createdAt: topic.created_at ? new Date(topic.created_at) : new Date(), reviewHistory: topic.review_history || [], reflectionHistory: topic.reflection_history || []
                }));
                return { success: true };
            } catch (error) { console.error("Error loading data:", error); ui.showToast(error.message || 'ไม่สามารถโหลดข้อมูลได้', 'error'); return { success: false }; }
        }
        async addSubject(name) {
            const trimmedName = name.trim(); if (!trimmedName) return null;
            if (this.subjects.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) { ui.showToast('มีบทเรียนชื่อนี้อยู่แล้ว', 'error'); return null; }
            try {
                const createdSubject = await this.#fetchAPI('/subjects', { method: 'POST', body: JSON.stringify({ id: Date.now(), name: trimmedName }) });
                this.subjects.push(createdSubject); this.subjects.sort((a, b) => a.name.localeCompare(b.name, 'th')); return createdSubject;
            } catch (error) { console.error('Failed to add subject:', error); ui.showToast('เกิดข้อผิดพลาดในการเพิ่มบทเรียน', 'error'); return null; }
        }
        async editSubject(id, newName) {
            const subjectId = Number(id); const trimmedName = newName.trim(); if (!trimmedName) return { success: false, message: 'ชื่อบทเรียนห้ามว่างเปล่า' };
            if (this.subjects.some(s => s.id !== subjectId && s.name.toLowerCase() === trimmedName.toLowerCase())) { return { success: false, message: 'มีบทเรียนชื่อนี้อยู่แล้ว' }; }
            const subject = this.subjects.find(s => s.id === subjectId);
            if (subject) {
                try { await this.#fetchAPI(`/subjects/${subjectId}`, { method: 'PUT', body: JSON.stringify({ name: trimmedName }) }); subject.name = trimmedName; return { success: true };
                } catch(error) { console.error('Failed to edit subject:', error); return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไข' }; }
            } return { success: false, message: 'ไม่พบบทเรียน' };
        }
        async deleteSubject(id) {
            try { await this.#fetchAPI(`/subjects/${Number(id)}`, { method: 'DELETE' }); this.subjects = this.subjects.filter(s => s.id !== Number(id)); this.topics = this.topics.filter(t => t.subjectId !== Number(id));
            } catch (error) { console.error('Failed to delete subject:', error); ui.showToast('เกิดข้อผิดพลาดในการลบ', 'error'); }
        }
        getAllSubjects() { return [...this.subjects].sort((a, b) => a.name.localeCompare(b.name, 'th')); }
        getSubjectNameById(id) { const subject = this.subjects.find(s => s.id === Number(id)); return subject ? subject.name : 'N/A'; }
        async addTopic(name, subjectId) {
            const trimmedName = name.trim(); const numSubjectId = Number(subjectId); if (!trimmedName || !numSubjectId) return null;
            try {
                const newTopicData = { id: Date.now() + Math.random(), name: trimmedName, subjectId: numSubjectId, nextReview: new Date().toISOString() };
                const createdTopicRaw = await this.#fetchAPI('/topics', { method: 'POST', body: JSON.stringify(newTopicData) });
                const createdTopic = { ...createdTopicRaw, id: Number(createdTopicRaw.id), subjectId: Number(createdTopicRaw.subject_id), nextReview: createdTopicRaw.next_review ? new Date(createdTopicRaw.next_review) : null, lastReview: createdTopicRaw.last_review ? new Date(createdTopicRaw.last_review) : null, createdAt: createdTopicRaw.created_at ? new Date(createdTopicRaw.created_at) : new Date(), reviewHistory: createdTopicRaw.review_history || [], reflectionHistory: createdTopicRaw.reflection_history || [] };
                this.topics.push(createdTopic); return createdTopic;
            } catch(error) { console.error('Failed to add topic:', error); ui.showToast('เกิดข้อผิดพลาดในการเพิ่มหัวข้อ', 'error'); return null; }
        }
        async editTopic(id, newName) {
            const topicId = Number(id); const trimmedName = newName.trim(); if (!trimmedName) return { success: false, message: 'ชื่อหัวข้อห้ามว่างเปล่า' };
            const topic = this.topics.find(t => t.id === topicId);
            if (topic) {
                if (this.topics.some(t => t.id !== topicId && t.subjectId === topic.subjectId && t.name.toLowerCase() === trimmedName.toLowerCase())) { return { success: false, message: 'มีหัวข้อชื่อนี้ในบทเรียนเดียวกันแล้ว' }; }
                try { await this.#fetchAPI(`/topics/${topicId}`, { method: 'PUT', body: JSON.stringify({ name: trimmedName }) }); topic.name = trimmedName; return { success: true };
                } catch(error) { console.error('Failed to edit topic:', error); return { success: false, message: 'เกิดข้อผิดพลาดในการแก้ไข' }; }
            } return { success: false, message: 'ไม่พบหัวข้อ' };
        }
        async deleteTopic(id) {
            try { await this.#fetchAPI(`/topics/${Number(id)}`, { method: 'DELETE' }); this.topics = this.topics.filter(t => t.id !== Number(id));
            } catch(error) { console.error('Failed to delete topic:', error); ui.showToast('เกิดข้อผิดพลาดในการลบ', 'error'); }
        }
        async updateTopicRating(id, ratingStr) {
            const topic = this.getTopicById(id); if (!topic) return;
            const rating = { again: 1, hard: 2, good: 3, easy: 4 }[ratingStr];
            const w = this.FSRS_PARAMS.w; const now = new Date(); const lastReviewDate = topic.lastReview ? new Date(topic.lastReview) : new Date(topic.createdAt);
            const elapsed_days = Math.max(0, (now.getTime() - lastReviewDate.getTime()) / (1000 * 3600 * 24)); const oldState = topic.state;
            if (oldState === 'New') { topic.difficulty = w[4] - w[5] * (rating - 3); topic.stability = w[rating - 1]; }
            else { const retrievability = Math.pow(1 + elapsed_days / (9 * topic.stability), this.DECAY); topic.difficulty = topic.difficulty - w[6] * (rating - 3); topic.difficulty = Math.min(Math.max(1, topic.difficulty), 10);
                if (rating === 1) { topic.stability = w[11] * Math.pow(topic.difficulty, -w[12]) * (Math.pow(topic.stability + 1, w[13]) - 1) * Math.exp((1 - retrievability) * w[14]); }
                else { topic.stability = topic.stability * (1 + Math.exp(w[8]) * (11 - topic.difficulty) * Math.pow(topic.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1)); }
            }
            topic.stability = Math.max(0.1, topic.stability); let newState; if (rating === 1) newState = 'Relearning'; else if (['New', 'Learning', 'Relearning'].includes(oldState)) newState = (rating >= 3) ? 'Review' : 'Learning'; else newState = 'Review';
            topic.state = newState; const nextReviewDate = new Date();
            if (['Learning', 'Relearning'].includes(topic.state)) { const mins = rating === 1 ? 5 : 10; nextReviewDate.setMinutes(now.getMinutes() + mins); }
            else { const days = Math.round(topic.stability * this.FACTOR); nextReviewDate.setDate(now.getDate() + Math.max(1, days)); }
            topic.lastReview = now; topic.nextReview = nextReviewDate;
            topic.reviewHistory.push({ date: now.toISOString(), rating: ratingStr, stability: topic.stability, difficulty: topic.difficulty, state: topic.state });
            try { const result = await this.#fetchAPI(`/topics/${id}/rating`, { method: 'PUT', body: JSON.stringify({ topicData: topic }) }); return { rating: ratingStr, date: topic.lastReview };
            } catch (error) { console.error("Failed to update rating:", error); ui.showToast('ไม่สามารถบันทึกผลการทบทวนได้', 'error'); }
        }
        async logReflection(topicId, reviewDate, rating, reasons, notes) {
            const topic = this.getTopicById(topicId);
            if (topic) {
                topic.reflectionHistory.push({ date: reviewDate, rating, reasons, notes });
                try { await this.#fetchAPI(`/topics/${topicId}/reflection`, { method: 'PUT', body: JSON.stringify({ reflectionHistory: topic.reflectionHistory }) });
                } catch (error) { console.error("Failed to log reflection:", error); topic.reflectionHistory.pop(); ui.showToast('ไม่สามารถบันทึกการสะท้อนผลได้', 'error'); }
            }
        }
        getTopicById(id) { return this.topics.find(t => t.id === Number(id)); }
        getAllTopics() { return [...this.topics]; }
        getDueTopics(date = new Date()) { const now = new Date(date); return this.topics.filter(topic => topic.nextReview && new Date(topic.nextReview) <= now).sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview)); }
        getLearningTopics() { const now = new Date(); const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999); return this.topics.filter(t => ['Learning', 'Relearning'].includes(t.state) && t.nextReview && new Date(t.nextReview) > now && new Date(t.nextReview) <= endOfToday).sort((a,b) => new Date(a.nextReview) - new Date(b.nextReview)); }
        getTopicPriority(topic) { const againCount = topic.reviewHistory.filter(r => r.rating === 'again').length; if (['Learning', 'Relearning'].includes(topic.state)) return { level: 1, key: 'urgent', icon: '🔥' }; if (againCount >= 4) return { level: 2, key: 'high', icon: '💀' }; if (topic.stability < 21) return { level: 3, key: 'standard', icon: '🟡' }; return { level: 4, key: 'general', icon: '' }; }
        searchTopics(query) { const q = query.trim().toLowerCase(); if (!q) return []; return this.topics.filter(t => t.name.toLowerCase().includes(q)).map(t => ({...t, subjectName: this.getSubjectNameById(t.subjectId)})).sort((a,b) => a.name.localeCompare(b.name, 'th')); }
        getLeeches(threshold = 4) { return this.topics.filter(topic => topic.reviewHistory.filter(r => r.rating === 'again').length >= threshold); }
        getAllData() { return { subjects: this.subjects, topics: this.topics }; }
        loadAllData(data) { ui.showToast("ฟังก์ชันนำเข้าข้อมูลยังไม่รองรับการบันทึกลงฐานข้อมูลโดยตรง", "error"); return { success: false, message: 'Not implemented' }; }
        deleteAllData() { ui.showToast("ฟังก์ชันนี้ยังไม่ถูกเชื่อมต่อกับฐานข้อมูล", "error"); }
        getCoachInsights(reviewsTodayCount) {
            const dueToday = this.getDueTopics(); let advice = "เริ่มต้นทบทวนหัวข้อที่ครบกำหนดของวันนี้ได้เลย!";
            if (this.getAllTopics().length === 0) { advice = "ยินดีต้อนรับ! เริ่มต้นด้วยการเพิ่มบทเรียนและหัวข้อแรกของคุณ"; } 
            else if (dueToday.length === 0 && this.getLearningTopics().length === 0) { advice = "ยอดเยี่ยม! ไม่มีหัวข้อค้างทบทวนสำหรับวันนี้"; } 
            else if (dueToday.length === 0 && this.getLearningTopics().length > 0) { advice = "ดีมาก! รออีกสักครู่แล้วหัวข้อที่กำลังเรียนรู้จะกลับมาให้ทบทวน"; } 
            else if (reviewsTodayCount > 10) { advice = `สุดยอดมาก วันนี้ทบทวนไป ${reviewsTodayCount} ครั้งแล้ว! พักผ่อนบ้างนะ`; } 
            else if (this.getLeeches().length > 0) { advice = "มี 'หัวข้อปราบเซียน' ที่ต้องจัดการ ลองเข้าไปดูและทบทวนเป็นพิเศษนะ"; } return { advice };
        }
        getStatsBySubject() {
            const data = { labels: [], new: [], learning: [], review: [] }; this.getAllSubjects().forEach(subject => { data.labels.push(subject.name); const insights = this.getSubjectInsights(subject.id); data.new.push(insights.stateDistribution.new); data.learning.push(insights.stateDistribution.learning); data.review.push(insights.stateDistribution.review); }); return data;
        }
        getForgetReasonStats() {
            const stats = { confused: 0, concept_issue: 0, forgot: 0, mistake: 0, other: 0 }; this.topics.forEach(topic => { if (topic.reflectionHistory && Array.isArray(topic.reflectionHistory)) { topic.reflectionHistory.forEach(reflection => { if(reflection.reasons && Array.isArray(reflection.reasons)) { reflection.reasons.forEach(reason => { if (stats.hasOwnProperty(reason)) { stats[reason]++; } }); } }); } }); return stats;
        }
        getSubjectInsights(subjectId) {
            const numSubjectId = Number(subjectId); const subjectTopics = this.topics.filter(t => t.subjectId === numSubjectId); if (subjectTopics.length === 0) { return { stateDistribution: { new: 0, learning: 0, review: 0 }, hardestTopic: null, nextReviewTopic: null }; }
            const stateDistribution = { new: 0, learning: 0, review: 0 }; subjectTopics.forEach(topic => { let state = (topic.state || 'New').toLowerCase(); if (state === 'relearning' || state === 'learning') { stateDistribution.learning++; } else if (state === 'review') { stateDistribution.review++; } else { stateDistribution.new++; } });
            const hardestTopic = [...subjectTopics].sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0))[0]; const nextReviewTopic = [...subjectTopics].filter(t => t.nextReview).sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))[0];
            return { stateDistribution, hardestTopic, nextReviewTopic };
        }
    }

    const app = {
        service: null, activeCharts: {}, currentTopicIdForModal: null, currentReflectionData: {}, selectedSubjectId: null, isSortedByPriority: false, ui: {},

        init() {
            this.service = new StudyService();
            this.cacheDOMElements();
            this.bindEventListeners();
            // The start() method is now called from the 'load' event listener
        },

        cacheDOMElements() {
            this.ui = {
                loadingOverlay: document.getElementById('loading-overlay'), toastContainer: document.getElementById('toast-container'), themeToggleBtn: document.getElementById('theme-toggle-btn'), navButtons: document.querySelectorAll('.nav-btn'), views: document.querySelectorAll('.view-content'), addTopicMainBtn: document.getElementById('add-topic-main-btn'), globalSearchInput: document.getElementById('global-search-input'), mainHeaderBar: document.getElementById('main-header-bar'),
                dashboard: { view: document.getElementById('dashboard-view'), countdownTgat: document.getElementById('countdown-tgat'), countdownAlevel: document.getElementById('countdown-alevel'), coachAdviceContent: document.getElementById('coach-advice-content'), due: document.getElementById('stats-due-value'), tomorrowDue: document.getElementById('stats-tomorrow-due-value'), reviewsToday: document.getElementById('stats-reviews-today-value'), leechCount: document.getElementById('stats-leech-count-value'), todaysQueueList: document.getElementById('todays-queue-list'), sortQueueBtn: document.getElementById('sort-queue-btn'), },
                subjects: { view: document.getElementById('subjects-view'), addForm: document.getElementById('add-subject-form'), addInput: document.getElementById('new-subject-name'), list: document.getElementById('subjects-list'), topicsList: document.getElementById('topics-for-subject-list'), insightsContainer: document.getElementById('subject-insights-container'), insightHardestTopic: document.getElementById('insight-hardest-topic'), insightNextReview: document.getElementById('insight-next-review'), subjectOverviewChart: document.getElementById('subject-overview-chart-in-subjects') },
                troubleZone: { view: document.getElementById('trouble-zone-view'), leechList: document.getElementById('leech-list') },
                analytics: { view: document.getElementById('analytics-view'), forgetReasonChart: document.getElementById('forget-reasons-chart'), subjectsOverviewChart: document.getElementById('subjects-overview-chart-in-analytics') },
                data: { view: document.getElementById('data-view'), exportBtn: document.getElementById('export-data-btn'), importBtn: document.getElementById('import-data-btn'), importInput: document.getElementById('import-data-input'), loadSampleBtn: document.getElementById('load-sample-data-btn'), deleteAllDataBtn: document.getElementById('delete-all-data-btn'), exportReminderBanner: document.getElementById('export-reminder-banner'), exportReminderBtn: document.getElementById('export-reminder-btn') },
                search: { dropdown: document.getElementById('search-results-dropdown') },
                modals: { logReview: document.getElementById('log-review-modal'), logReviewName: document.getElementById('modal-log-topic-name'), reflection: document.getElementById('reflection-modal'), reflectionName: document.getElementById('modal-reflection-topic-name'), reflectionForm: document.getElementById('reflection-form'), reflectionNotes: document.getElementById('reflection-notes'), topicDetails: document.getElementById('topic-details-modal'), detailsTopicName: document.getElementById('modal-details-topic-name'), detailsState: document.getElementById('details-state'), detailsNextReview: document.getElementById('details-next-review'), detailsStability: document.getElementById('details-stability'), detailsDifficulty: document.getElementById('details-difficulty'), detailsHistoryList: document.getElementById('details-history-list'), showChartBtn: document.getElementById('show-chart-btn'), chart: document.getElementById('chart-modal'), chartTopicName: document.getElementById('chart-modal-topic-name'), addTopic: document.getElementById('add-topic-modal'), addTopicForm: document.getElementById('add-topic-form-modal'), addTopicSelect: document.getElementById('topic-subject-select'), addTopicInput: document.getElementById('new-topic-name-modal'), welcome: document.getElementById('welcome-modal') }
            };
            // Make ui globally available inside the app object for the service
            // This is a bit of a hack, better to pass ui as a dependency. For now it works.
            window.ui = { showToast: this.showToast.bind(this) };
        },

        bindEventListeners() {
            // Simplified global click handler example
            document.body.addEventListener('click', (e) => {
                if (e.target.closest('.modal-close-btn')) this.closeAllModals();
                // Add more specific event bindings below
            });
            this.ui.navButtons.forEach(button => button.addEventListener('click', () => this.switchView(button.dataset.view)));
            this.ui.themeToggleBtn.addEventListener('click', this.toggleTheme.bind(this));
        },

        async start() {
            this.showLoading(true);
            await this.service.loadDataFromServer();
            this.showLoading(false);

            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark-mode');
            }

            this.refreshAllUI('dashboard');
            // Bind other events that depend on data being loaded
            this.bindDataDependentEventListeners();

            if (this.service.getAllSubjects().length === 0 && this.service.getAllTopics().length === 0) {
                setTimeout(() => this.openModal(this.ui.modals.welcome), 500);
            }
        },

        bindDataDependentEventListeners() {
            // Placeholder for events that need data to be loaded first
            // Example:
            // this.ui.subjects.addForm.addEventListener('submit', this.onAddSubject.bind(this));
        },

        showLoading(isLoading) {
            this.ui.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        },

        showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            this.ui.toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'toast-out-right 0.5s ease forwards';
                toast.addEventListener('animationend', () => toast.remove());
            }, 3000);
        },

        switchView(viewName) {
            this.ui.views.forEach(view => view.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');
            this.ui.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
            this.refreshAllUI(viewName);
        },

        refreshAllUI(currentView) {
            // This would be a large function to call all smaller render functions
            console.log(`Refreshing UI for view: ${currentView}`);
            // e.g., this.renderDashboard(); if (currentView === 'subjects') this.renderSubjects(); etc.
        },

        openModal(modalElement) {
            modalElement.classList.add('active');
        },

        closeAllModals() {
            document.querySelectorAll('.modal-container.active').forEach(modal => modal.classList.remove('active'));
        },

        toggleTheme() {
            document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
            // You might need to re-render charts here if their colors depend on the theme
        }

        // ... other methods like onAddSubject, onLogReview, renderDashboard, etc. would go here
    };

    // --- App Initialization Logic ---
    let appHasStarted = false;
    const startAppOnce = async () => {
        if (!appHasStarted) {
            appHasStarted = true;
            app.init(); // Sets up properties, caches DOM, binds static events
            await app.start(); // Loads data, binds dynamic events, does initial render
        }
    };

    window.addEventListener('load', () => {
        const appLayout = document.getElementById('app-layout');
        const loadingOverlay = document.getElementById('loading-overlay');

        if (window.netlifyIdentity) {
            netlifyIdentity.on('init', user => {
                if (user) {
                    // If user is already logged in, show the app and start it.
                    if(loadingOverlay) loadingOverlay.style.display = 'none';
                    if(appLayout) appLayout.style.display = 'flex';
                    startAppOnce();
                } else {
                    // If no user, show loading spinner and redirect to login page.
                    if(loadingOverlay) loadingOverlay.style.display = 'flex';
                    // We wait a moment for the widget to potentially auto-login
                    setTimeout(() => {
                         // Double check if a login happened in that short time
                        if (!netlifyIdentity.currentUser()) {
                            window.location.href = '/login.html';
                        }
                    }, 500);
                }
            });

            netlifyIdentity.on('logout', () => {
                window.location.href = '/';
            });

        } else {
            console.error("Netlify Identity widget failed to load.");
            document.body.innerHTML = '<h1>Error: Login widget failed to load. Please refresh.</h1>';
        }
    });

})();