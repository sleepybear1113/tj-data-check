importScripts('objects.js');
importScripts('../lib/xlsx.0.20.3.mini.min.js');

self.onmessage = function (e) {
    const {file, chunkSize} = e.data;
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

            // 处理表头
            const headers = jsonData[0];
            const rows = jsonData.slice(1);
            const totalRows = rows.length;

            // 分批处理数据
            const processChunk = (startIndex) => {
                const endIndex = Math.min(startIndex + chunkSize, totalRows);
                const chunk = rows.slice(startIndex, endIndex);

                const students = chunk.map(row => {
                    const studentData = {};
                    headers.forEach((header, index) => {
                        studentData[header] = row[index];
                    });
                    return new Student(studentData);
                });

                // 验证学生数据
                students.forEach((student) => {
                    student.checkValidate();
                });

                // 发送进度和当前批次的数据
                self.postMessage({
                    type: 'progress',
                    progress: (endIndex / totalRows) * 100,
                    current: endIndex,
                    total: totalRows,
                    students: students.filter(s => s.errorList.length > 0)
                });

                // 如果还有数据，继续处理下一批
                if (endIndex < totalRows) {
                    setTimeout(() => processChunk(endIndex), 0);
                } else {
                    self.postMessage({type: 'complete'});
                }
            };

            // 开始处理数据
            processChunk(0);

        } catch (error) {
            self.postMessage({type: 'error', error: error.message});
        }
    };

    reader.onerror = function () {
        self.postMessage({type: 'error', error: 'File reading failed'});
    };

    reader.readAsArrayBuffer(file);
}; 