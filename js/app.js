const {createApp} = Vue;

const app = createApp({
    data() {
        return {
            selectedFileName: '',
            tableHeaders: Student.getFields(), // 去掉序号和错误信息列
            sortColumn: null,
            sortDirection: 'asc',
            currentPage: 1,
            pageSize: 100,
            inputPageSize: 100,
            inputPage: 1,
            processing: false,
            progress: 0,
            currentRow: 0,
            totalRows: 0,
            errorStudents: []
        };
    },
    computed: {
        sortedData() {
            if (this.sortColumn === null) return this.errorStudents;

            return [...this.errorStudents].sort((a, b) => {
                const aValue = a[this.sortColumn];
                const bValue = b[this.sortColumn];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                }

                const aStr = String(aValue || '');
                const bStr = String(bValue || '');
                return this.sortDirection === 'asc'
                    ? aStr.localeCompare(bStr)
                    : bStr.localeCompare(aStr);
            });
        },
        totalRecords() {
            return this.errorStudents.length;
        },
        totalPages() {
            return Math.ceil(this.totalRecords / this.pageSize);
        },
        paginatedData() {
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            return this.sortedData.slice(start, end);
        },
        displayedPages() {
            const pages = [];
            const start = Math.max(1, this.currentPage - 3);
            const end = Math.min(this.totalPages, this.currentPage + 3);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            return pages;
        }
    },
    methods: {
        selectFile() {
            // 触发文件选择对话框，每次都是新建一个input元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', this.handleFileSelect);
            fileInput.click();
        },
        async handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.selectedFileName = file.name;
            this.processing = true;
            this.progress = 0;
            this.currentRow = 0;
            this.totalRows = 0;
            this.errorStudents = [];

            try {
                await this.processFileWithWorker(file);
            } catch (error) {
                console.error('Error processing file:', error);
                alert('处理文件时发生错误，请重试');
            } finally {
                this.processing = false;
            }
        },
        processFileWithWorker(file) {
            return new Promise((resolve, reject) => {
                const worker = new Worker('js/worker.js');

                worker.onmessage = (e) => {
                    const {type, progress, current, total, students, error} = e.data;

                    switch (type) {
                        case 'progress':
                            this.progress = progress;
                            this.currentRow = current;
                            this.totalRows = total;
                            this.errorStudents = [...this.errorStudents, ...students];
                            break;
                        case 'complete':
                            worker.terminate();
                            resolve();
                            break;
                        case 'error':
                            worker.terminate();
                            reject(new Error(error));
                            break;
                    }
                };

                worker.onerror = (error) => {
                    worker.terminate();
                    reject(error);
                };

                worker.postMessage({
                    file,
                    chunkSize: 100
                });
            });
        },
        sortTable(columnIndex) {
            if (this.sortColumn === columnIndex) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumn = columnIndex;
                this.sortDirection = 'asc';
            }
        },
        goToPage(page) {
            if (page >= 1 && page <= this.totalPages) {
                this.currentPage = page;
                this.inputPage = page;
            }
        },
        goToInputPage() {
            const page = parseInt(this.inputPage);
            if (!isNaN(page) && page >= 1 && page <= this.totalPages) {
                this.goToPage(page);
            } else {
                this.inputPage = this.currentPage;
            }
        },
        changePageSize() {
            const newSize = parseInt(this.inputPageSize);
            if (!isNaN(newSize) && newSize > 0) {
                this.pageSize = newSize;
                this.currentPage = 1;
                this.inputPage = 1;
            } else {
                this.inputPageSize = this.pageSize;
            }
        },
        exportExcel() {
            // 创建工作簿
            const wb = XLSX.utils.book_new();

            // 准备数据
            const data = this.errorStudents.map(student => {
                const row = {};
                this.tableHeaders.forEach(header => {
                    if (header === '错误信息') {
                        row[header] = student.errorList.join(', ');
                    } else {
                        row[header] = student[header] || '';
                    }
                });
                return row;
            });

            // 创建工作表
            const ws = XLSX.utils.json_to_sheet(data);

            // 设置列宽
            ws['!cols'] = this.tableHeaders.map(() => ({wch: 15}));

            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(wb, ws, "异常学生数据");

            // 生成文件名
            const now = new Date();
            const filename = `体检异常学生-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}.xlsx`;

            // 导出文件
            XLSX.writeFile(wb, filename);
        }
    },
    mounted() {
        document.getElementById('fileInput').addEventListener('change', this.handleFileSelect);
    }
});

app.mount('#app'); 