// 游戏主逻辑文件

// 全局变量
let scene, camera, renderer, controls;
let cubeGroup, ball;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cubeSize = 3; // 3x3x3魔方
let cellSize = 2; // 每个小格子的大小
let isGameCompleted = false;
let isRotating = false;
let currentLayer = null;
let currentAxis = null;
let rotationAngle = 0;
let targetRotation = 0;
let rotationSpeed = 0.05;
let initialCameraPosition, initialCameraTarget;
let hintMarkers = [];

// 调试函数
function debug(message) {
    console.log('[DEBUG] ' + message);
    const debugElement = document.getElementById('debug-log');
    if (debugElement) {
        const debugInfo = document.getElementById('debug-info');
        debugInfo.style.display = 'block';
        debugElement.innerHTML += message + '<br>';
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

// 小球物理属性
let ballVelocity = new THREE.Vector3(0, 0, 0);
let ballAcceleration = new THREE.Vector3(0, -0.002, 0); // 重力加速度
let friction = 0.98; // 摩擦系数
let restitution = 0.6; // 弹性系数

// 入口和出口位置
let entrancePosition = { x: -cellSize, y: -cellSize, z: -cellSize };
let exitPosition = { x: cellSize, y: cellSize, z: cellSize };

// 性能优化相关变量
let lastTime = 0;
let frameCount = 0;
let fps = 60;
let shouldUpdatePhysics = true;
let physicsUpdateInterval = 16; // 约60fps
let lastPhysicsUpdate = 0;

// 游戏状态变量
let gameStartTime = 0;
let gameDuration = 0;

// 初始化函数
function init() {
    debug('初始化游戏开始');
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    debug('场景创建完成');
    
    // 创建相机
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(70, aspectRatio, 0.1, 1000);
    camera.position.set(10, 8, 10); // 调整位置以获得更好的视角
    debug('相机创建完成，位置: x=' + camera.position.x + ', y=' + camera.position.y + ', z=' + camera.position.z);
    
    // 保存初始相机位置和目标，用于重置视角
    initialCameraPosition = camera.position.clone();
    initialCameraTarget = new THREE.Vector3(0, 0, 0);
    // 设置相机看向魔方中心
    camera.lookAt(0, 0, 0); // 明确看向坐标原点(魔方中心)
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比例以提高性能
    
    const container = document.getElementById('game-container');
    if (container) {
        container.appendChild(renderer.domElement);
        debug('渲染器添加到容器完成');
    } else {
        debug('错误: 找不到game-container元素');
    }
    
    // 添加轨道控制器
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.maxDistance = 30;
    controls.minDistance = 8;
    debug('轨道控制器创建完成');
    
    // 添加灯光
    addLights();
    debug('灯光添加完成');
    
    // 创建魔方
    createRubikCube();
    debug('魔方创建完成，包含 ' + (cubeGroup ? cubeGroup.children.length : '未创建') + ' 个子元素');
    
    // 创建小球
    createBall();
    debug('小球创建完成');
    
    // 添加事件监听
    addEventListeners();
    debug('事件监听添加完成');
    
    // 添加UI按钮事件监听
    try {
        document.getElementById('restart-game-button').addEventListener('click', restartGame);
        document.getElementById('reset-view-button').addEventListener('click', resetView);
        document.getElementById('hint-button').addEventListener('click', showHint);
        debug('UI按钮事件监听添加完成');
    } catch (e) {
        debug('UI按钮事件监听添加失败: ' + e.message);
    }
    
    // 记录游戏开始时间
    gameStartTime = performance.now();
    
    // 开始动画循环
    lastTime = performance.now();
    animate();
    debug('初始化完成，开始动画循环');
    
    // 响应窗口大小变化
    window.addEventListener('resize', onWindowResize);
}

// 添加灯光
function addLights() {
    // 增强环境光强度
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // 增强主方向光强度
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);
    
    // 添加第二个方向光
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);
    
    // 添加额外的侧面光以提高可见性
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sideLight.position.set(2, 0, -1);
    scene.add(sideLight);
}

// 创建魔方
function createRubikCube() {
    debug('开始创建魔方');
    cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    debug('魔方组创建并添加到场景');
    
    // 魔方颜色配置
    const faceColors = {
        front: 0xff0000,    // 红色
        back: 0x0000ff,     // 蓝色
        left: 0x00ff00,     // 绿色
        right: 0xffff00,    // 黄色
        top: 0xff8800,      // 橙色
        bottom: 0xffffff    // 白色
    };
    
    // 创建每个小格子
    const geometry = new THREE.BoxGeometry(cellSize - 0.1, cellSize - 0.1, cellSize - 0.1);
    debug('小格子几何体创建完成');
    
    let cubeCount = 0;
    // 遍历创建3x3x3的小格子
    for (let x = 0; x < cubeSize; x++) {
        for (let y = 0; y < cubeSize; y++) {
            for (let z = 0; z < cubeSize; z++) {
                // 为每个面创建不同的材质 - 使用不依赖光照的MeshBasicMaterial以确保可见性
                const materials = [];
                
                // 前面 (z = 2)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: z === cubeSize - 1 ? faceColors.front : 0x444444
                }));
                
                // 后面 (z = 0)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: z === 0 ? faceColors.back : 0x444444
                }));
                
                // 上面 (y = 2)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: y === cubeSize - 1 ? faceColors.top : 0x444444
                }));
                
                // 下面 (y = 0)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: y === 0 ? faceColors.bottom : 0x444444
                }));
                
                // 右面 (x = 2)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: x === cubeSize - 1 ? faceColors.right : 0x444444
                }));
                
                // 左面 (x = 0)
                materials.push(new THREE.MeshBasicMaterial({ 
                    color: x === 0 ? faceColors.left : 0x444444
                }));
                
                // 特殊标记入口和出口
                if (x === 0 && y === 0 && z === 0) {
                    materials[1] = new THREE.MeshBasicMaterial({ // 后面
                        color: 0x00ff00, // 绿色 - 入口
                        wireframe: false
                    });
                    debug('创建入口格子: x=' + x + ', y=' + y + ', z=' + z);
                } else if (x === cubeSize - 1 && y === cubeSize - 1 && z === cubeSize - 1) {
                    materials[0] = new THREE.MeshBasicMaterial({ // 前面
                        color: 0xff0000, // 红色 - 出口
                        wireframe: false
                    });
                    debug('创建出口格子: x=' + x + ', y=' + y + ', z=' + z);
                }
                
                const cube = new THREE.Mesh(geometry, materials);
                
                // 设置位置
                const posX = (x - Math.floor(cubeSize / 2)) * cellSize;
                const posY = (y - Math.floor(cubeSize / 2)) * cellSize;
                const posZ = (z - Math.floor(cubeSize / 2)) * cellSize;
                
                cube.position.set(posX, posY, posZ);
                debug('创建小格子: x=' + x + ', y=' + y + ', z=' + z + ', 位置: (' + posX + ',' + posY + ',' + posZ + ')');
                
                // 保存位置信息，用于碰撞检测
                cube.userData = {
                    originalPosition: { x: posX, y: posY, z: posZ },
                    gridPosition: { x: x, y: y, z: z }
                };
                
                cubeGroup.add(cube);
                cubeCount++;
            }
        }
    }
    
    debug('创建完成 ' + cubeCount + ' 个小格子');
    
    // 添加魔方框架线，增强视觉效果
    addCubeFrame();
    debug('魔方框架线添加完成');
}

// 添加魔方框架线
function addCubeFrame() {
    const frameGroup = new THREE.Group();
    
    // 创建边缘线材质
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    
    // 计算魔方的整体大小
    const size = cellSize * (cubeSize - 1);
    const halfSize = size / 2;
    
    // 创建12条边的线
    const edges = [
        // 前面
        [[-halfSize, -halfSize, halfSize], [halfSize, -halfSize, halfSize]],
        [[halfSize, -halfSize, halfSize], [halfSize, halfSize, halfSize]],
        [[halfSize, halfSize, halfSize], [-halfSize, halfSize, halfSize]],
        [[-halfSize, halfSize, halfSize], [-halfSize, -halfSize, halfSize]],
        // 后面
        [[-halfSize, -halfSize, -halfSize], [halfSize, -halfSize, -halfSize]],
        [[halfSize, -halfSize, -halfSize], [halfSize, halfSize, -halfSize]],
        [[halfSize, halfSize, -halfSize], [-halfSize, halfSize, -halfSize]],
        [[-halfSize, halfSize, -halfSize], [-halfSize, -halfSize, -halfSize]],
        // 连接前后
        [[-halfSize, -halfSize, -halfSize], [-halfSize, -halfSize, halfSize]],
        [[halfSize, -halfSize, -halfSize], [halfSize, -halfSize, halfSize]],
        [[halfSize, halfSize, -halfSize], [halfSize, halfSize, halfSize]],
        [[-halfSize, halfSize, -halfSize], [-halfSize, halfSize, halfSize]]
    ];
    
    edges.forEach(edge => {
        const points = [
            new THREE.Vector3(edge[0][0], edge[0][1], edge[0][2]),
            new THREE.Vector3(edge[1][0], edge[1][1], edge[1][2])
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        frameGroup.add(line);
    });
    
    cubeGroup.add(frameGroup);
}

// 创建小球
function createBall() {
    const geometry = new THREE.SphereGeometry(0.4, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    ball = new THREE.Mesh(geometry, material);
    
    // 将小球放在入口位置
    ball.position.set(entrancePosition.x, entrancePosition.y, entrancePosition.z);
    
    scene.add(ball);
}

// 添加事件监听
function addEventListeners() {
    // 鼠标事件
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // 窗口大小调整
    window.addEventListener('resize', onWindowResize);
    
    // 重新开始按钮事件
    document.getElementById('restart-button').addEventListener('click', restartGame);
    
    // 触摸事件 - 优化移动设备支持
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    
    // 防止移动设备上的默认行为
    document.addEventListener('gesturestart', preventDefault, { passive: false });
    document.addEventListener('gesturechange', preventDefault, { passive: false });
    document.addEventListener('gestureend', preventDefault, { passive: false });
    
    // 键盘事件支持
    document.addEventListener('keydown', onKeyDown);
}

// 阻止默认事件
function preventDefault(e) {
    e.preventDefault();
}

// 键盘事件处理
function onKeyDown(event) {
    // 空格键重置游戏
    if (event.code === 'Space') {
        restartGame();
    }
    // R键重置视角
    else if (event.code === 'KeyR') {
        resetView();
    }
    // H键显示提示
    else if (event.code === 'KeyH') {
        showHint();
    }
}

// 触摸事件处理 - 增强移动设备体验
let touchStartTime;

function onTouchStart(event) {
    // 阻止默认行为（例如滚动）
    event.preventDefault();
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        previousMousePosition.x = touch.clientX;
        previousMousePosition.y = touch.clientY;
        isDragging = true;
        
        // 记录触摸开始时间，用于区分点击和拖动
        touchStartTime = performance.now();
        
        // 射线检测，确定用户点击的是哪个层
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
            (touch.clientX / window.innerWidth) * 2 - 1,
            -(touch.clientY / window.innerHeight) * 2 + 1
        );
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cubeGroup.children, true);
        
        if (intersects.length > 0) {
            // 获取点击的立方体
            const clickedCube = intersects[0].object;
            const gridPos = clickedCube.userData.gridPosition;
            const faceIndex = intersects[0].faceIndex;
            
            // 确定要旋转的层和轴
            determineRotationLayerAndAxis(gridPos, faceIndex);
        }
    }
}

function onTouchMove(event) {
    // 阻止默认行为（例如滚动）
    event.preventDefault();
    
    if (isDragging && event.touches.length === 1) {
        const touch = event.touches[0];
        
        // 计算触摸移动距离
        const deltaX = touch.clientX - previousMousePosition.x;
        const deltaY = touch.clientY - previousMousePosition.y;
        
        // 如果移动距离很小，不做处理，避免误触
        const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (moveDistance < 3) return;
        
        // 更新触摸位置
        previousMousePosition.x = touch.clientX;
        previousMousePosition.y = touch.clientY;
        
        // 如果正在旋转魔方层，继续旋转
        if (isRotating) {
            return;
        }
        
        // 如果有选中的层，旋转该层
        if (currentLayer !== null) {
            // 计算旋转角度
            let angle = 0;
            if (currentAxis === 'x') {
                angle = deltaY * 0.01;
            } else if (currentAxis === 'y') {
                angle = deltaX * 0.01;
            } else if (currentAxis === 'z') {
                angle = deltaX * 0.01;
            }
            
            // 应用层旋转
            rotateLayer(currentLayer, currentAxis, angle);
        } else {
            // 如果没有选中任何魔方层，则旋转整个视角
            // 增强移动设备上的视角旋转灵敏度
            const rotateFactor = 0.005;
            cubeGroup.rotation.y += deltaX * rotateFactor;
            cubeGroup.rotation.x += deltaY * rotateFactor;
        }
        
        // 更新小球位置
        updateBallPosition();
    }
}

function onTouchEnd(event) {
    if (isDragging) {
        const touchEndTime = performance.now();
        const touchDuration = touchEndTime - touchStartTime;
        
        // 如果触摸时间很短，认为是点击操作
        if (touchDuration < 200) {
            // 处理点击事件
            const touch = event.changedTouches[0];
            handleTap(touch.clientX, touch.clientY);
        }
        
        isDragging = false;
        
        // 如果旋转了层，对齐到90度的倍数
        if (currentLayer !== null) {
            snapRotationToNearest90();
        }
        
        // 重置当前层和轴
        currentLayer = null;
        currentAxis = null;
        
        // 检查游戏是否完成
        checkWinCondition();
    }
}

// 处理点击操作
function handleTap(clientX, clientY) {
    // 射线检测，确定用户点击的是哪个层
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubeGroup.children, true);
    
    if (intersects.length > 0) {
        // 获取点击的立方体
        const clickedCube = intersects[0].object;
        const gridPos = clickedCube.userData.gridPosition;
        const faceIndex = intersects[0].faceIndex;
        
        // 确定要旋转的层和轴
        determineRotationLayerAndAxis(gridPos, faceIndex);
        
        // 如果选中了魔方层，开始旋转
        if (currentLayer !== null) {
            isRotating = true;
            targetRotation = Math.PI / 2;
        }
    }
}

// 鼠标按下处理
function onMouseDown(event) {
    if (isGameCompleted || isRotating) return;
    
    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    
    // 射线检测，确定用户点击的是哪个层
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubeGroup.children, true);
    
    if (intersects.length > 0) {
        // 获取点击的立方体
        const clickedCube = intersects[0].object;
        const gridPos = clickedCube.userData.gridPosition;
        const faceIndex = intersects[0].faceIndex;
        
        // 确定要旋转的层和轴
        determineRotationLayerAndAxis(gridPos, faceIndex);
    }
}

// 确定旋转的层和轴
function determineRotationLayerAndAxis(gridPos, faceIndex) {
    // 根据面的索引确定旋转轴
    if (faceIndex === 0 || faceIndex === 1) { // 前后面，绕Y轴旋转
        currentAxis = 'y';
        currentLayer = gridPos.z;
    } else if (faceIndex === 2 || faceIndex === 3) { // 上下面，绕X轴旋转
        currentAxis = 'x';
        currentLayer = gridPos.y;
    } else { // 左右面，绕Z轴旋转
        currentAxis = 'z';
        currentLayer = gridPos.x;
    }
}

// 鼠标移动处理
function onMouseMove(event) {
    if (!isDragging || isGameCompleted || isRotating) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };
    
    if (currentLayer !== null) {
        // 计算旋转角度
        let angle = 0;
        if (currentAxis === 'x') {
            angle = deltaMove.y * 0.01;
        } else if (currentAxis === 'y') {
            angle = deltaMove.x * 0.01;
        } else if (currentAxis === 'z') {
            angle = deltaMove.x * 0.01;
        }
        
        // 应用层旋转
        rotateLayer(currentLayer, currentAxis, angle);
    } else {
        // 如果没有选择特定层，则旋转整个魔方
        cubeGroup.rotation.y += deltaMove.x * 0.01;
        cubeGroup.rotation.x += deltaMove.y * 0.01;
    }
    
    previousMousePosition = { x: event.clientX, y: event.clientY };
    
    // 更新小球位置
    updateBallPosition();
}

// 鼠标释放处理
function onMouseUp() {
    if (!isDragging || isGameCompleted) return;
    
    isDragging = false;
    
    // 如果旋转了层，对齐到90度的倍数
    if (currentLayer !== null) {
        snapRotationToNearest90();
    }
    
    // 重置当前层和轴
    currentLayer = null;
    currentAxis = null;
    
    // 检查游戏是否完成
    checkWinCondition();
}

// 旋转特定层
function rotateLayer(layerIndex, axis, angle) {
    // 遍历所有立方体，找到属于该层的立方体
    cubeGroup.children.forEach(cube => {
        if (cube.userData.gridPosition[axis] === layerIndex) {
            // 保存初始位置（相对于立方体组）
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(cube.matrixWorld);
            cubeGroup.worldToLocal(position);
            
            // 旋转立方体
            if (axis === 'x') {
                cube.rotateX(angle);
            } else if (axis === 'y') {
                cube.rotateY(angle);
            } else if (axis === 'z') {
                cube.rotateZ(angle);
            }
            
            // 保持立方体在正确的位置
            cube.position.copy(position);
        }
    });
}

// 对齐旋转到最近的90度
function snapRotationToNearest90() {
    isRotating = true;
    
    // 这里简化处理，直接对齐
    // 在实际应用中，可以添加动画效果
    
    setTimeout(() => {
        isRotating = false;
    }, 300);
}

// 更新小球位置（基于物理引擎）
function updateBallPosition() {
    if (isGameCompleted) return;
    
    // 获取当前的重力方向（基于魔方的旋转）
    const gravity = new THREE.Vector3(0, -0.002, 0);
    const rotatedGravity = new THREE.Vector3();
    rotatedGravity.copy(gravity);
    rotatedGravity.applyQuaternion(cubeGroup.quaternion);
    
    // 应用重力加速度
    ballVelocity.add(rotatedGravity);
    
    // 应用摩擦力
    ballVelocity.multiplyScalar(friction);
    
    // 微小速度时停止移动，避免抖动
    if (ballVelocity.length() < 0.001) {
        ballVelocity.set(0, 0, 0);
    }
    
    // 更新小球位置
    ball.position.add(ballVelocity);
    
    // 进行碰撞检测（优化：只在有速度时检查）
    if (ballVelocity.lengthSq() > 0) {
        checkCollisions();
    }
    
    // 限制小球的最大速度
    const maxSpeed = 0.3;
    if (ballVelocity.lengthSq() > maxSpeed * maxSpeed) {
        ballVelocity.normalize().multiplyScalar(maxSpeed);
    }
    
    // 检查小球是否掉落
    checkBallOutOfBounds();
}

// 碰撞检测
function checkCollisions() {
    // 获取魔方的世界变换矩阵
    cubeGroup.updateMatrixWorld(true);
    
    // 优化：只检查靠近小球的立方体
    let collisionOccurred = false;
    let closestCube = null;
    let minDistance = Infinity;
    let closestDistanceVector = null;
    let closestNormal = null;
    
    // 先找出所有可能发生碰撞的立方体
    const potentialCollisions = [];
    cubeGroup.children.forEach(cube => {
        // 跳过框架线
        if (!cube.userData.gridPosition) return;
        
        // 获取小格子在世界坐标系中的位置
        const cubeWorldPosition = new THREE.Vector3();
        cubeWorldPosition.setFromMatrixPosition(cube.matrixWorld);
        
        // 计算到小球的距离
        const distance = ball.position.distanceTo(cubeWorldPosition);
        
        // 只考虑距离小球较近的立方体（距离小于2倍格子大小）
        if (distance < cellSize * 2) {
            potentialCollisions.push({ cube, worldPos: cubeWorldPosition });
        }
        
        // 找出最近的立方体
        if (distance < minDistance) {
            minDistance = distance;
            closestCube = cube;
        }
    });
    
    // 只对潜在碰撞的立方体进行详细计算
    potentialCollisions.forEach(({ cube, worldPos }) => {
        // 计算小球和小格子中心的距离向量
        const distanceVector = new THREE.Vector3();
        distanceVector.subVectors(ball.position, worldPos);
        
        // 计算各个轴上的距离
        const halfCubeSize = (cellSize - 0.1) / 2;
        const ballRadius = 0.4;
        
        // 计算碰撞方向和重叠
        const overlapX = halfCubeSize + ballRadius - Math.abs(distanceVector.x);
        const overlapY = halfCubeSize + ballRadius - Math.abs(distanceVector.y);
        const overlapZ = halfCubeSize + ballRadius - Math.abs(distanceVector.z);
        
        // 如果在所有轴上都有重叠，则发生碰撞
        if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
            // 找出最小的重叠轴
            const minOverlap = Math.min(overlapX, overlapY, overlapZ);
            
            // 创建碰撞法线
            const normal = new THREE.Vector3(0, 0, 0);
            
            if (minOverlap === overlapX) {
                normal.x = distanceVector.x > 0 ? 1 : -1;
            } else if (minOverlap === overlapY) {
                normal.y = distanceVector.y > 0 ? 1 : -1;
            } else {
                normal.z = distanceVector.z > 0 ? 1 : -1;
            }
            
            // 保存最近的碰撞信息
            if (!closestDistanceVector || ball.position.distanceTo(worldPos) < ball.position.distanceTo(closestDistanceVector)) {
                closestDistanceVector = worldPos;
                closestNormal = normal;
                collisionOccurred = true;
            }
        }
    });
    
    // 处理最近的碰撞
    if (collisionOccurred && closestDistanceVector && closestNormal) {
        // 分离小球和格子
        const distanceVector = new THREE.Vector3();
        distanceVector.subVectors(ball.position, closestDistanceVector);
        const halfCubeSize = (cellSize - 0.1) / 2;
        const ballRadius = 0.4;
        
        let minOverlap;
        if (closestNormal.x !== 0) {
            minOverlap = halfCubeSize + ballRadius - Math.abs(distanceVector.x);
        } else if (closestNormal.y !== 0) {
            minOverlap = halfCubeSize + ballRadius - Math.abs(distanceVector.y);
        } else {
            minOverlap = halfCubeSize + ballRadius - Math.abs(distanceVector.z);
        }
        
        ball.position.addScaledVector(closestNormal, minOverlap);
        
        // 计算小球速度在法线方向上的分量
        const velocityAlongNormal = ballVelocity.dot(closestNormal);
        
        // 如果小球正在远离格子，则不进行碰撞响应
        if (velocityAlongNormal < 0) {
            // 计算碰撞后的速度
            const bounce = new THREE.Vector3();
            bounce.copy(closestNormal).multiplyScalar(-2 * velocityAlongNormal);
            ballVelocity.addScaledVector(bounce, restitution);
        }
    }
}

// 检查小球是否出界
function checkBallOutOfBounds() {
    const maxDistance = cellSize * cubeSize * 1.5;
    if (ball.position.lengthSq() > maxDistance * maxDistance) {
        // 小球出界，重置到入口位置
        ball.position.set(entrancePosition.x, entrancePosition.y, entrancePosition.z);
        ballVelocity.set(0, 0, 0);
    }
}

// 检查胜利条件
function checkWinCondition() {
    // 遍历所有立方体，找到出口格子
    let exitCube = null;
    cubeGroup.children.forEach(cube => {
        // 检查是否是出口格子（红色前面）
        if (cube.userData.gridPosition && 
            cube.userData.gridPosition.x === cubeSize - 1 && 
            cube.userData.gridPosition.y === cubeSize - 1 && 
            cube.userData.gridPosition.z === cubeSize - 1) {
            exitCube = cube;
        }
    });
    
    if (exitCube) {
        // 获取出口格子在世界坐标系中的位置
        const exitWorldPosition = new THREE.Vector3();
        exitWorldPosition.setFromMatrixPosition(exitCube.matrixWorld);
        
        // 计算小球到出口的距离
        const distanceToExit = ball.position.distanceTo(exitWorldPosition);
        
        // 如果小球足够接近出口，则游戏获胜
        if (distanceToExit < cellSize * 0.6) {
            completeGame();
        }
    }
}

// 完成游戏
function completeGame() {
    if (isGameCompleted) return;
    
    isGameCompleted = true;
    
    // 停止小球移动
    ballVelocity.set(0, 0, 0);
    
    // 添加胜利效果
    addWinEffect();
    
    // 显示胜利消息
    setTimeout(() => {
        const winMessage = document.getElementById('win-message');
        winMessage.style.display = 'block';
        
        // 添加震动反馈（如果浏览器支持）
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }, 500);
}

// 添加胜利效果
function addWinEffect() {
    // 为小球添加发光效果
    ball.material.emissive.set(0xffff00);
    ball.material.emissiveIntensity = 0.5;
    
    // 创建粒子效果
    createParticleEffect(ball.position);
    
    // 轻微缩放效果
    let scale = 1;
    const scaleInterval = setInterval(() => {
        scale *= 1.02;
        ball.scale.set(scale, scale, scale);
        
        if (scale > 1.3) {
            clearInterval(scaleInterval);
            
            // 恢复原始大小
            setTimeout(() => {
                ball.scale.set(1, 1, 1);
                ball.material.emissiveIntensity = 0;
            }, 500);
        }
    }, 20);
}

// 创建粒子效果
function createParticleEffect(position) {
    const particleCount = 50;
    const particlesGeometry = new THREE.BufferGeometry();
    
    // 创建粒子位置数组
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;
        
        // 随机速度
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        velocities.push(velocity);
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // 创建粒子材质
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    
    // 创建粒子系统
    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);
    
    // 动画粒子
    let frameCount = 0;
    const animateParticles = () => {
        if (frameCount > 60) {
            scene.remove(particleSystem);
            return;
        }
        
        const positions = particleSystem.geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // 更新位置
            positions[i3] += velocities[i].x;
            positions[i3 + 1] += velocities[i].y;
            positions[i3 + 2] += velocities[i].z;
            
            // 应用重力
            velocities[i].y -= 0.002;
            
            // 应用阻力
            velocities[i].multiplyScalar(0.97);
        }
        
        particleSystem.geometry.attributes.position.needsUpdate = true;
        
        // 逐渐减少透明度
        particleSystem.material.opacity = 0.8 - (frameCount / 60) * 0.8;
        
        frameCount++;
        requestAnimationFrame(animateParticles);
    };
    
    animateParticles();
}

// 重新开始游戏
function restartGame() {
    // 重置游戏状态
    isGameCompleted = false;
    document.getElementById('win-message').style.display = 'none';
    
    // 重置魔方旋转
    cubeGroup.rotation.set(0, 0, 0);
    
    // 重置小球位置
    ball.position.set(entrancePosition.x, entrancePosition.y, entrancePosition.z);
    
    // 清除提示效果
    if (hintMarkers) {
        hintMarkers.forEach(marker => scene.remove(marker));
        hintMarkers = [];
    }
    
    // 重置物理参数
    ballVelocity.set(0, 0, 0);
    ballAcceleration.set(0, -0.002, 0);
    
    // 重置游戏时间
    gameStartTime = performance.now();
    gameDuration = 0;
}

// 窗口大小变化处理
function onWindowResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera.aspect = aspectRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 确保相机一直看向魔方中心
    camera.lookAt(0, 0, 0);
}

// 重置视角到初始位置
function resetView() {
    // 使用动画平滑过渡到初始视角
    const duration = 0.8;
    const startTime = performance.now();
    const startPosition = camera.position.clone();
    const startTarget = new THREE.Vector3();
    controls.target.clone(startTarget);
    
    function animateCamera() {
        const elapsed = (performance.now() - startTime) / duration;
        const progress = Math.min(elapsed / 1000, 1);
        
        // 使用缓动函数
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        camera.position.lerpVectors(startPosition, initialCameraPosition, easeProgress);
        controls.target.lerpVectors(startTarget, initialCameraTarget, easeProgress);
        camera.lookAt(controls.target);
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

// 显示提示
function showHint() {
    // 找到入口和出口的位置
    let entranceCube = null;
    let exitCube = null;
    
    cubeGroup.children.forEach(cube => {
        if (cube.userData.gridPosition && 
            cube.userData.gridPosition.x === 0 && 
            cube.userData.gridPosition.y === 0 && 
            cube.userData.gridPosition.z === 0) {
            entranceCube = cube;
        } else if (cube.userData.gridPosition && 
            cube.userData.gridPosition.x === cubeSize - 1 && 
            cube.userData.gridPosition.y === cubeSize - 1 && 
            cube.userData.gridPosition.z === cubeSize - 1) {
            exitCube = cube;
        }
    });
    
    // 添加发光效果到入口和出口
    // 先移除现有的提示效果
    if (hintMarkers) {
        hintMarkers.forEach(marker => scene.remove(marker));
    }
    hintMarkers = [];
    
    // 为入口添加绿色发光效果
    if (entranceCube) {
        const entranceWorldPosition = new THREE.Vector3();
        entranceWorldPosition.setFromMatrixPosition(entranceCube.matrixWorld);
        const entranceMarker = createHintMarker(entranceWorldPosition, 0x00ff00);
        scene.add(entranceMarker);
        hintMarkers.push(entranceMarker);
    }
    
    // 为出口添加红色发光效果
    if (exitCube) {
        const exitWorldPosition = new THREE.Vector3();
        exitWorldPosition.setFromMatrixPosition(exitCube.matrixWorld);
        const exitMarker = createHintMarker(exitWorldPosition, 0xff0000);
        scene.add(exitMarker);
        hintMarkers.push(exitMarker);
    }
    
    // 3秒后移除提示效果
    setTimeout(() => {
        if (hintMarkers) {
            hintMarkers.forEach(marker => scene.remove(marker));
            hintMarkers = [];
        }
    }, 3000);
}

// 创建提示标记
function createHintMarker(position, color) {
    const geometry = new THREE.SphereGeometry(0.55, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });
    const marker = new THREE.Mesh(geometry, material);
    
    marker.position.copy(position);
    
    // 添加脉冲动画
    const animateMarker = () => {
        const time = performance.now() * 0.001;
        marker.scale.set(1 + Math.sin(time * 2) * 0.2, 1 + Math.sin(time * 2) * 0.2, 1 + Math.sin(time * 2) * 0.2);
        requestAnimationFrame(animateMarker);
    };
    animateMarker();
    
    return marker;
}

// 动画循环
function animate() {
    // 确保每帧都请求下一帧，放置在函数开头
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // 更新FPS计数器
    frameCount++;
    if (frameCount === 1 || frameCount >= 60) {
        fps = Math.round(60000 / deltaTime);
        if (frameCount === 1) {
            // 首次渲染时添加更多调试信息
            debug('首次渲染，FPS估计: ' + fps);
            debug('相机位置: x=' + camera.position.x + ', y=' + camera.position.y + ', z=' + camera.position.z);
            debug('魔方组状态: ' + (cubeGroup ? '存在' : '不存在') + ', 子元素数量: ' + (cubeGroup ? cubeGroup.children.length : 'N/A'));
            debug('渲染器尺寸: ' + renderer.domElement.width + 'x' + renderer.domElement.height);
            debug('场景中的物体数量: ' + scene.children.length);
        }
        if (frameCount >= 60) {
            frameCount = 0;
            debug('FPS: ' + fps + ', 每帧平均时间: ' + (deltaTime/60).toFixed(2) + 'ms');
            debug('场景中的物体数量: ' + scene.children.length);
        }
    }
    
    // 根据性能调整物理更新频率
    if (fps < 30) {
        physicsUpdateInterval = 33; // 降低到约30fps
    } else if (fps < 45) {
        physicsUpdateInterval = 22; // 降低到约45fps
    } else {
        physicsUpdateInterval = 16; // 保持60fps
    }

    controls.update();
    
    // 如果游戏未完成，持续更新小球位置（基于时间间隔）
    if (!isGameCompleted) {
        if (currentTime - lastPhysicsUpdate >= physicsUpdateInterval) {
            updateBallPosition();
            lastPhysicsUpdate = currentTime;
        }
    }
    
    // 更新游戏时间
    if (!isGameCompleted) {
        gameDuration = currentTime - gameStartTime;
    }
    
    // 确保渲染不会被跳过，添加错误捕获
    try {
        // 简化渲染条件检查
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
            // 每10帧输出一次渲染信息，避免控制台过于拥挤
            if (frameCount % 10 === 0) {
                debug('场景渲染完成 - 帧: ' + frameCount);
            }
        } else {
            debug('渲染错误: renderer=' + !!renderer + ', scene=' + !!scene + ', camera=' + !!camera);
        }
    } catch (error) {
        // 捕获可能的渲染错误
        console.error('渲染出错:', error);
        debug('渲染异常: ' + error.message);
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', init);