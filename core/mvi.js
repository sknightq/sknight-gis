/**
 * mvi - methods to perform multivariate interpolation
 * 多元插值
 *
 * Copyright (c) 2013 Cameron Beccario
 * The MIT License - http://opensource.org/licenses/MIT
 * https://github.com/cambecc/air
 *
 * Thin plate spline code adapted from TPSDemo, Copyright (c) 2003, 2004, 2005 by Jarno Elonen.
 * http://elonen.iki.fi/code/tpsdemo
 *
 * LU decomposition adapted from JAMA project created by NIST.
 * http://math.nist.gov/javanumerics/jama
 */
;(function(root, factory) {
  "use strict"
  if (typeof define === "function" && define.amd) {
    // AMD
    define([], factory)
  } else if (typeof exports === "object") {
    // Node, CommonJS之类的
    module.exports = factory()
  } else {
    root.mvi = factory()
  }
})(this, function() {
  "use strict"
  var mvi = {
    scaleVector: scaleVector,
    addVectors: addVectors,
    inverseDistanceWeighting: inverseDistanceWeighting,
    thinPlateSpline: thinPlateSpline,
    bilinear: bilinear,
    kdTree: kdTree
  }

  /**
   * @param  {array} v
   * @param  {number} s
   * @description  向量缩放
   *
   * Multiply the vector v (in rectangular [x, y] form) by the scalar s, in place, and return it.
   */
  function scaleVector(v, s) {
    v[0] *= s
    v[1] *= s
    return v
  }

  /**
   * @param  {array} a
   * @param  {array} b
   * @description  向量相加
   * Add the second vector into the first and return it. Both vectors must be in rectangular [x, y] form.
   */
  function addVectors(a, b) {
    a[0] += b[0]
    a[1] += b[1]
    return a
  }

  /**
   * @param  {number} x0
   * @param  {number} y0
   * @param  {number} x1
   * @param  {number} y1
   * @description 两点距离的平方
   * Returns the square of the distance between the two specified points x0, y0 and x1, y1.
   */
  function dist2(x0, y0, x1, y1) {
    var Δx = x0 - x1
    var Δy = y0 - y1
    return Δx * Δx + Δy * Δy
  }

  /**
   * @param  {number} x0
   * @param  {number} y0
   * @param  {number} x1
   * @param  {number} y1
   * @description 两点距离
   * Returns the distance between the two specified points x0, y0 and x1, y1.
   */
  function dist(x0, y0, x1, y1) {
    return Math.sqrt(dist2(x0, y0, x1, y1))
  }

  /**
   * @param  {array} points
   * @param  {number} k
   * @param  {number} depth
   * @description d维空间查找离点最近的k个点，是个二叉树。现在是构建一个k维空间的二叉树
   *
   * Builds a k-d tree from the specified points, each point of the form [x, y, ...]
   */
  function kdTree(points, k, depth) {
    if (points.length == 0) {
      return null
    }
    // 当前维度，例如0表示x维，1表示y维，2表示z维
    // 根据k维依次划分平面建树
    var axis = depth % k
    // cycle through each axis as we descend downwards
    // 根据当前纬度进行降序排序
    var compareByAxis = function(a, b) {
      return a[axis] - b[axis]
    }
    points.sort(compareByAxis)

    // Pivot on the median point using the policy that all points to the left must be _strictly smaller_.
    // 获得当前维度下降序排列的中间点作为根节点
    var median = Math.floor(points.length / 2)
    var node = points[median]

    // Scan backwards for points aligned on the same axis. We want the start of any such sequence.
    // 再次向左边区域查询点，在严格意义上获得当前维度的根节点都要大于左边区域
    while (median > 0 && compareByAxis(node, points[median - 1]) === 0) {
      node = points[--median]
    }

    // 对左右子节点构造二叉树
    node.left = kdTree(points.slice(0, median), k, depth + 1)
    node.right = kdTree(points.slice(median + 1), k, depth + 1)

    // Provide a function that easily calculates a point's distance to the partitioning plane of this node.
    // 添加一个计算当前维度距离的方法
    var plane = node[axis]
    node.planeDistance = function(p) {
      return plane - p[axis]
    }

    return node
  }

  /**

     */
  /**
   * @param  {array} a 要处理的最近邻近点数组
   * @param  {object} key 新加入的点
   * @description 给定一个数组，利用数组建堆算法进行处理，最后最大值在二叉树顶端，然后每次最大值a[0]总会被新的a[0]的替换，所以最后数组a里存下的是无序的最近的邻近值
   * 参考：http://blog.csdn.net/qq508618087/article/details/53362999
   *
   * Given array a, representing a binary heap, this method pushes the key down from the top of the heap. After
   * invocation, the key having the largest "distance2" value is at the top of the heap.
   */
  function heapify(a, key) {
    var i = 0
    var length = a.length
    var child
    while ((child = i * 2 + 1) < length) {
      var favorite = a[child]
      var right = child + 1
      var r
      // 先找出最有节点最大的一个，然后最大和根节点（key）比较
      if (right < length && (r = a[right]).distance2 > favorite.distance2) {
        favorite = r
        child = right
      }
      // 如果key是最大的，就放在根节点
      if (key.distance2 >= favorite.distance2) {
        break
      }
      a[i] = favorite
      i = child
    }
    // 如果key比其他节点都小，就放到叶子节点处
    a[i] = key
  }

  /**
   * @param  {array} point 站点数据
   * @param  {object} node 构建好的k-d Tree
   * @param  {array} results 最近邻近值的数组
   * @description  对于指定的点，找出其邻近的点， results里预先设定了最近邻近点的个数，最后result存储的结果是无序的邻近点
   * 参考：https://www.cnblogs.com/tsingyawn/p/6159201.html
   *
   * Finds the neighbors nearest to the specified point, starting the search at the k-d tree provided as 'node'.
   * The n closest neighbors are placed in the results array (of length n) in no defined order.
   */
  /**
   * @param  {} point 指定点
   * @param  {} node K-D树
   * @param  {} results 指定点向量
   */
  function nearest(point, node, results) {
    // This recursive function descends the k-d tree, visiting partitions containing the desired point.
    // As it descends, it keeps a priority queue of the closest neighbors found. Each visited node is
    // compared against the worst (i.e., most distant) neighbor in the queue, replacing it if the current
    // node is closer. The queue is implemented as a binary heap so the worst neighbor is always the
    // element at the top of the queue.

    // 计算点到第一次区域划分的距离
    // Calculate distance of the point to the plane this node uses to split the search space.
    var planeDistance = node.planeDistance(point)

    var containingSide
    var otherSide

    if (planeDistance <= 0) {
      // 点在当前划分区域的右区域中
      // point is contained in the right partition of the current node.
      containingSide = node.right
      otherSide = node.left
    } else {
      // 点在当前划分区域的左区域中
      // point is contained in the left partition of the current node.
      containingSide = node.left
      otherSide = node.right
    }

    // 继续在包含的区域中查询
    if (containingSide) {
      // Search the containing partition for neighbors.
      nearest(point, containingSide, results)
    }

    // 代码走到这里表示k-d tree已经没有更小的区域划分了，此时node就是一个点，用距离的平方来避免不必要的开方计算。
    // Now determine if the current node is a close neighbor. Do the comparison using _squared_ distance to
    // avoid unnecessary Math.sqrt operations.
    var d2 = dist2(point[0], point[1], node[0], node[1])
    var n = results[0]
    if (d2 < n.distance2) {
      // Current node is closer than the worst neighbor encountered so far, so replace it and adjust the queue.
      n.point = node
      n.distance2 = d2
      heapify(results, n)
    }

    if (otherSide) {
      // The other partition *might* have relevant neighbors if the point is closer to the partition plane
      // than the worst neighbor encountered so far. If so, descend down the other side.
      if (planeDistance * planeDistance < results[0].distance2) {
        nearest(point, otherSide, results)
      }
    }
  }

  /**
   * @param  {array} points 坐标点
   * @param  {number} k 要查找最近邻近点个数
   * @description 返回一个方法，利用反距离权重法去获得一个新的向量，而权重根据k邻近算法获取
   *
   * Returns a function that performs inverse distance weighting (en.wikipedia.org/wiki/Inverse_distance_weighting)
   * interpolation over the specified points using k closest neighbors. The points array must be comprised of
   * elements with the structure [x, y, z], where z is a vector [vx, vy] in rectangular form.
   *
   * The returned function has the signature f(x, y, result). When invoked, a zero vector should be passed as
   * 'result' to provide the initial value. After invocation, result holds the interpolated vector vxi, vyi in its
   * 0th and 1st elements, respectively.
   */
  function inverseDistanceWeighting(points, k) {
    // Build a space partitioning tree to use for quick lookup of closest neighbors.
    // 构建一个二维空间的kd二叉树用于快速查找邻近点
    var tree = kdTree(points, 2, 0)

    // Define special scratch objects for intermediate calculations to avoid unnecessary array allocations.
    // 定义一个空数组用来存储最近K个个邻近点
    var temp = []
    var nearestNeighbors = []
    for (var i = 0; i < k; i++) {
      nearestNeighbors.push({})
    }

    function clear() {
      for (var i = 0; i < k; i++) {
        var n = nearestNeighbors[i]
        n.point = null
        n.distance2 = Infinity
      }
    }

    // Return a function that interpolates a vector for the point (x, y) and stores it in "result".
    return function(x, y, result) {
      var weightSum = 0

      clear() // reset our scratch objects
      temp[0] = x
      temp[1] = y

      // 获得最近邻近点存储在nearestNeighbors
      nearest(temp, tree, nearestNeighbors) // calculate nearest neighbors

      // Sum up the values at each nearest neighbor, adjusted by the inverse square of the distance.
      for (var i = 0; i < k; i++) {
        var neighbor = nearestNeighbors[i]
        var sample = neighbor.point[2]
        var d2 = neighbor.distance2
        if (d2 === 0) {
          // (x, y) is exactly on top of a point.
          result[0] = sample[0]
          result[1] = sample[1]
          return result
        }
        var weight = 1 / d2
        temp[0] = sample[0]
        temp[1] = sample[1]
        // 利用反距离权重法（距离越近，影响越大，所以用距离的倒数作为权值）
        result = addVectors(result, scaleVector(temp, weight))
        weightSum += weight
      }

      // 权值相加后再除以总权值来获得一个新的插值向量
      // Divide by the total weight to calculate an average, which is our interpolated result.
      return scaleVector(result, 1 / weightSum)
    }
  }

  /**
   * @param  {arry} a 需要交换的数组
   * @param  {number} i 交换位置i
   * @param  {number} j 交换位置j
   *
   * 在数组a中交换i,j位置的俩个值
   * Swap elements i and j in array a.
   */
  function swap(a, i, j) {
    var t = a[i]
    a[i] = a[j]
    a[j] = t
  }

  /**
   * @param  {array} a
   * @param  {array} b
   * @param  {number} i
   * @description
   * Swap element i between two arrays a and b.
   */
  /**
   * @param  {arry} a 需要交换的数组
   * @param  {number} b 需要交换的数组
   * @param  {number} i 交换位置
   *
   * 在数组a,b中交换各自在位置i上的值
   * Swap element i between two arrays a and b.
   */
  function swapBetween(a, b, i) {
    var t = a[i]
    a[i] = b[i]
    b[i] = t
  }

  /**
   * @param  {num} rows 矩阵行数
   * @param  {num} columns 矩阵列数
   * @description 创建矩阵
   *
   * Returns a two-dimensional array [rows][columns] with each element initialized to 0.
   */
  function createMatrix(rows, columns) {
    var M = []
    for (var i = 0; i < rows; i++) {
      M[i] = []
      for (var j = 0; j < columns; j++) {
        M[i][j] = 0
      }
    }
    M.rows = rows
    M.columns = columns
    return M
  }

  /**
   * @param  {array} M 矩阵
   * @description 创建对角线对称矩阵
   *
   * Copies elements from the top-right to the bottom-left.
   */
  function mirrorDiagonal(M) {
    for (var i = 0; i < M.rows; i++) {
      for (var j = i + 1; j < M.columns; j++) {
        M[j][i] = M[i][j]
      }
    }
    return M
  }

  /**
   * @param  {} M
   * @description
   *
   * Finds the LU decomposition for matrix M, modifying M in place.
   */
  function LUDecomposition(M) {
    var pivots = M.map(function(row, i) {
      return i
    })
    var i, j

    for (var k = 0; k < M.columns; k++) {
      // Find pivot p.
      var p = k
      for (i = k + 1; i < M.rows; i++) {
        if (Math.abs(M[i][k]) > Math.abs(M[p][k])) {
          p = i
        }
      }

      // Exchange if necessary.
      if (p != k) {
        for (j = 0; j < M.columns; j++) {
          swapBetween(M[p], M[k], j)
        }
        swap(pivots, p, k)
      }

      // Compute multipliers and eliminate k-th column.
      if (M[k][k] != 0.0) {
        for (i = k + 1; i < M.rows; i++) {
          M[i][k] /= M[k][k]
          for (j = k + 1; j < M.columns; j++) {
            M[i][j] -= M[i][k] * M[k][j]
          }
        }
      }
    }

    M.pivots = pivots
    return M
  }

  /**
   * @param  {} M
   * @description
   * Returns true if matrix M is singular.
   */
  function isSingular(M) {
    for (var i = 0; i < Math.min(M.rows, M.columns); i++) {
      if (M[i][i] == 0.0) {
        return true
      }
    }
    return false
  }

  /**
   * @param  {} M
   * @param  {} pivots
   * @description
   * Creates a copy of matrix M according to the specified array of pivots.
   */
  function copyWithPivoting(M, pivots) {
    var A = createMatrix(M.rows, M.columns)
    for (var i = 0; i < M.rows; i++) {
      for (var j = 0; j < M.columns; j++) {
        A[i][j] = M[pivots[i]][j]
      }
    }
    return A
  }

  /**
   * @param  {array} L 变换矩阵的逆矩阵
   * @param  {array} B 第三维z(要素值)的矩阵
   * @description 计算出拟合曲面的参数矩阵X
   *
   * Returns matrix X such that L · X = B.
   */
  /**
   * @param  {} L
   * @param  {} B
   */
  function solve(L, B) {
    if (L.rows != B.rows)
      throw new Error(
        "Matrix row dimensions must agree: " + L.rows + " " + B.rows
      )

    var LU = LUDecomposition(L)

    if (isSingular(LU)) throw new Error("Matrix is singular")

    var X = copyWithPivoting(B, LU.pivots)
    var i, j, k

    // Solve LU.L * Y = B
    for (k = 0; k < LU.columns; k++) {
      for (i = k + 1; i < LU.columns; i++) {
        for (j = 0; j < B.columns; j++) {
          X[i][j] -= X[k][j] * LU[i][k]
        }
      }
    }

    // Solve LU.U * X = Y
    for (k = LU.columns - 1; k >= 0; k--) {
      for (j = 0; j < B.columns; j++) {
        X[k][j] /= LU[k][k]
      }
      for (i = 0; i < k; i++) {
        for (j = 0; j < B.columns; j++) {
          X[i][j] -= X[k][j] * LU[i][k]
        }
      }
    }

    return X
  }

  /**
   * @param  {number} r 距离
   * @description 径向基函数
   *
   * TPS kernel function.
   */
  function φ(r) {
    return r == 0.0 ? 0.0 : r * r * Math.log(r)
  }

  /**
   * @param  {array} points
   * @param  {number} rigidity
   * @description 创建变换矩阵的逆,利用此逆矩阵和已知点Z轴的值（要素值）组成的矩阵乘积算出曲面拟合函数参数
   *
   *  Creates the L matrix for TPS interpolation.
   */
  function buildL(points, rigidity) {
    var n = points.length
    var L = createMatrix(n + 3, n + 3)
    var a = 0 // mean of distances between control points' xy-projections

    // Calculate how much each point influences all other points using radial basis function φ.
    for (var i = 0; i < n; i++) {
      var x = points[i][0]
      var y = points[i][1]
      for (var j = i + 1; j < n; j++) {
        var d = dist(x, y, points[j][0], points[j][1])
        L[i][j] = φ(d)
        a += d * 2
      }
      L[i][n + 0] = 1.0
      L[i][n + 1] = x
      L[i][n + 2] = y
    }

    // Set rigidity parameters on the diagonal.
    a /= n * n
    for (var k = 0; k < n; k++) {
      L[k][k] = rigidity * a * a // λa^2
    }

    // L is diagonally symmetrical, no need to recalculate the other side.
    // 转化为对角线对称矩阵
    return mirrorDiagonal(L)
  }

  /**
   * @param  {array} points
   * @description 第三维z(要素值)的矩阵
   *
   * Creates the B matrix for TPS interpolation.
   */
  function buildB(points) {
    var B = createMatrix(points.length + 3, 1)
    points.forEach(function(point, i) {
      B[i][0] = point[2] // z-coordinate
    })
    return B
  }

  /**

     *
     * @param {array} points an array of control points having the form: [[x0, y0, z0], [x1, y1, z1], ... ]
     * @param {number} rigidity the rigidity of the deformation: larger values increase relaxation (smoothness) of the
     *                 interpolated surface, with 0 the most rigid (goes exactly through all control points)
     * @returns {Function} f(x, y) -> z
     * @description 实际原理是根据所给定的点作为二维平面（x,y），要素值为第三维（z），然后根据这些点拟合出一个曲面函数。最后根据这函数插值计
     *              算出其他坐标点的要素值。给定点至少要3个（3点确定一个平面）
     * 
     * 参考1：http://blog.csdn.net/iverson_49/article/details/38160081
     * 参考2：en.wikipedia.org/wiki/Thin_plate_spline
     * 
     * Returns a function that performs thin plate spline (en.wikipedia.org/wiki/Thin_plate_spline) interpolation
     * over the specified control points. The resulting function has the signature f(x, y) and returns the z value
     * interpolated at that point. At least three control points are required.
     */
  function thinPlateSpline(points, rigidity) {
    // Solve for matrix X of unknown weights in the linear equation system: L·X=B, where matrix L contains
    // the control points' relationships, and B is a matrix of the control points' z-coordinates.

    var n = points.length
    var L = buildL(points, rigidity) // n+3 × n+3
    var B = buildB(points) // n+3 × 1
    var X = solve(L, B) // n+3 × 1

    var weights = X.map(function(row) {
      return row[0]
    })
    var a1 = weights[n + 0]
    var a2 = weights[n + 1]
    var a3 = weights[n + 2]

    return function(x, y) {
      var z = a1 + a2 * x + a3 * y
      for (var i = 0; i < n; i++) {
        var point = points[i]
        z += weights[i] * φ(dist(point[0], point[1], x, y))
      }
      return z
    }
  }

  /**
   * @param  {} x
   * @param  {} y
   * @param  {} g00
   * @param  {} g10
   * @param  {} g01
   * @param  {} g11
   * @description
   */
  function bilinear(x, y, g00, g10, g01, g11) {
    // g(0, 0)(1 - x)(1 - y) + g(1, 0)x(1-y) + g(0, 1)(1 - x)y + g(1, 1)xy

    var s = (1 - x) * (1 - y)
    var t = x * (1 - y)
    var u = (1 - x) * y
    var v = x * y
    return [
      g00[0] * s + g10[0] * t + g01[0] * u + g11[0] * v,
      g00[1] * s + g10[1] * t + g01[1] * u + g11[1] * v
    ]
  }

  return mvi
})
