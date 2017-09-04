// Source: code from http://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
export function multiplyMatrices(m1, m2) {
  var result = [];
  for (var i = 0; i < m1.length; i++) {
    result[i] = [];
    for (var j = 0; j < m2[0].length; j++) {
      var sum = 0;
      for (var k = 0; k < m1[0].length; k++) {
        sum += m1[i][k] * m2[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}
//exports.multiplyMatrices = multiplyMatrices;

export function quaternionToEuler(quaternion) {
  var w = quaternion[3];
  var x = quaternion[0];
  var y = quaternion[1];
  var z = quaternion[2];

  var sqx = x * x;
  var sqy = y * y;
  var sqz = z * z;

  var rotX = Math.atan2(2 * (y * w - x * z), 1 - 2 * (sqy + sqz));
  var rotY = Math.asin(2 * ( x * y + z * w));
  var rotZ = Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * (sqx + sqz));

  return [rotX, rotY, rotZ];
}
//exports.quaternionToEuler = quaternionToEuler;

export function degreeToRadian (degree) {
  return degree * (Math.PI / 180);
}
//exports.degreeToRadian = degreeToRadian;

export function radianToDegree (radian) {
  return radian * (180/Math.PI);
}
//exports.radianToDegree = radianToDegree;