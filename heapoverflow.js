const cluster = require('cluster');
const v8 = require('v8');

let heavyHeapConsumer = () => {
    let arrays = [];
    setInterval(() => {
        arrays.push(new Array(1000000));
    }, 100);
};

if (cluster.isMaster) {
    cluster.fork();
    cluster.on('exit', (deadWorker, code, signal) => {
        // Restart the worker
        let worker = cluster.fork();

        // Note the process IDs
        let newPID = worker.process.pid;
        let oldPID = deadWorker.process.pid;

        // Log the event
        console.log('worker '+oldPID+' died.');
        console.log('worker '+newPID+' born.');
    });
}
else { // worker
    // auxiliary function that translates size from bytes to MB's
    let toMB = size => Math.round(size / 1024 / 1024 * 100) / 100;

    const initialStats = v8.getHeapStatistics();
    Object.keys(initialStats).forEach(key => initialStats[key] = toMB(initialStats[key]));

    // heap_size_limit: The absolute limit the heap cannot exceed (default limit or --max_old_space_size)
    const totalHeapSizeThreshold = initialStats.heap_size_limit * 85/100;
    console.log("totalHeapSizeThreshold: " + totalHeapSizeThreshold);

    let detectHeapOverflow = () => {
        let stats = v8.getHeapStatistics();
        Object.keys(stats).forEach(key => stats[key] = toMB(stats[key]));

        // heap size allocated by V8. This can grow if usedHeap needs more.
        console.log("total_heap_size: " + (stats.total_heap_size));

        // total_heap_size: Number of bytes V8 has allocated for the heap. This can grow if used_heap_size needs more.
        // we'll detect when it's growing above some threshold and kill the worker in such case
        if ((stats.total_heap_size) > totalHeapSizeThreshold) {
            process.exit();
        }
    };
    setInterval(detectHeapOverflow, 1000);

    // here goes the main logic
    heavyHeapConsumer();
}