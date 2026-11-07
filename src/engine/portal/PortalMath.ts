import { Matrix4, Quaternion, Vector3 } from 'three';
import type {
  Portal,
  PortalCrossing,
  PortalPose,
  PortalTransformInput,
  PortalTransformResult,
} from './PortalTypes';

const MATRIX_TOLERANCE = 1e-7;
const CROSSING_EPSILON = 1e-9;
const UNIT_SCALE = new Vector3(1, 1, 1);
const HALF_TURN = new Matrix4().makeRotationY(Math.PI);

function finiteVector(value: Vector3, label: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new RangeError(`${label} must contain finite coordinates`);
  }
}

function unitQuaternion(value: Quaternion, label: string): void {
  if (![value.x, value.y, value.z, value.w].every(Number.isFinite)
    || Math.abs(value.lengthSq() - 1) > MATRIX_TOLERANCE) {
    throw new RangeError(`${label} must be a finite unit quaternion`);
  }
}

/** Rejects scale, shear, reflection, perspective, tilt and singular matrices. */
export function validatePortalMatrix(matrix: Matrix4): void {
  const e = matrix.elements;
  if (!e.every(Number.isFinite)) throw new RangeError('Portal matrix must be finite');
  if (Math.abs(e[3]!) > MATRIX_TOLERANCE || Math.abs(e[7]!) > MATRIX_TOLERANCE
    || Math.abs(e[11]!) > MATRIX_TOLERANCE || Math.abs(e[15]! - 1) > MATRIX_TOLERANCE) {
    throw new RangeError('Portal matrix must be affine');
  }
  const x = new Vector3(e[0], e[1], e[2]);
  const y = new Vector3(e[4], e[5], e[6]);
  const z = new Vector3(e[8], e[9], e[10]);
  if ([x, y, z].some(axis => Math.abs(axis.lengthSq() - 1) > MATRIX_TOLERANCE)
    || Math.abs(x.dot(y)) > MATRIX_TOLERANCE
    || Math.abs(x.dot(z)) > MATRIX_TOLERANCE
    || Math.abs(y.dot(z)) > MATRIX_TOLERANCE
    || Math.abs(matrix.determinant() - 1) > MATRIX_TOLERANCE) {
    throw new RangeError('Portal matrix must be rigid, unscaled and nonsingular');
  }
  if (Math.abs(y.x) > MATRIX_TOLERANCE || Math.abs(y.y - 1) > MATRIX_TOLERANCE
    || Math.abs(y.z) > MATRIX_TOLERANCE) {
    throw new RangeError('G0 portals may rotate only around world +Y');
  }
}

export function portalWorldMatrix(pose: PortalTransformInput): Matrix4 {
  if (pose instanceof Matrix4) {
    validatePortalMatrix(pose);
    return pose.clone();
  }
  finiteVector(pose.position, 'Portal position');
  unitQuaternion(pose.rotation, 'Portal rotation');
  const matrix = new Matrix4().compose(pose.position, pose.rotation, UNIT_SCALE);
  validatePortalMatrix(matrix);
  return matrix;
}

/** M_destination * Ry(pi) * inverse(M_source). No scene or engine dependencies. */
export function computePortalTransform(
  source: PortalTransformInput,
  destination: PortalTransformInput,
): PortalTransformResult {
  const matrix = portalWorldMatrix(destination)
    .multiply(HALF_TURN)
    .multiply(portalWorldMatrix(source).invert());
  validatePortalMatrix(matrix);
  return { matrix, rotation: new Quaternion().setFromRotationMatrix(matrix).normalize() };
}

function transformMatrix(transform: PortalTransformResult | Matrix4): Matrix4 {
  const matrix = transform instanceof Matrix4 ? transform : transform.matrix;
  validatePortalMatrix(matrix);
  return matrix;
}

export function transformPosition(
  position: Vector3,
  transform: PortalTransformResult | Matrix4,
): Vector3 {
  finiteVector(position, 'Position');
  const result = position.clone().applyMatrix4(transformMatrix(transform));
  finiteVector(result, 'Transformed position');
  return result;
}

/** Rotates a displacement/velocity without translation or normalization. */
export function transformDirection(
  direction: Vector3,
  transform: PortalTransformResult | Matrix4,
): Vector3 {
  finiteVector(direction, 'Direction');
  const e = transformMatrix(transform).elements;
  const result = new Vector3(
    e[0]! * direction.x + e[4]! * direction.y + e[8]! * direction.z,
    e[1]! * direction.x + e[5]! * direction.y + e[9]! * direction.z,
    e[2]! * direction.x + e[6]! * direction.y + e[10]! * direction.z,
  );
  finiteVector(result, 'Transformed direction');
  return result;
}

export function transformQuaternion(
  orientation: Quaternion,
  transform: PortalTransformResult | Quaternion | Matrix4,
): Quaternion {
  unitQuaternion(orientation, 'Orientation');
  const rotation = transform instanceof Quaternion ? transform
    : new Quaternion().setFromRotationMatrix(transformMatrix(transform));
  unitQuaternion(rotation, 'Transform rotation');
  return rotation.clone().multiply(orientation).normalize();
}

export function portalLocalPoint(point: Vector3, pose: PortalPose): Vector3 {
  finiteVector(point, 'Point');
  const result = point.clone().applyMatrix4(portalWorldMatrix(pose).invert());
  finiteVector(result, 'Portal-local point');
  return result;
}

export function computeSignedPlaneDistance(point: Vector3, pose: PortalPose): number {
  return portalLocalPoint(point, pose).z;
}

function validateAperture(portal: Portal, radius: number, halfHeight: number): void {
  if (![portal.width, portal.height, radius, halfHeight].every(Number.isFinite)
    || portal.width <= 0 || portal.height <= 0 || radius < 0 || halfHeight < 0) {
    throw new RangeError('Aperture dimensions and capsule extents must be finite and valid');
  }
}

/** Point is in world coordinates; capsule extents are horizontal radius and total half height. */
export function isPointInsideAperture(
  point: Vector3,
  portal: Portal,
  radius = 0,
  halfHeight = 0,
): boolean {
  validateAperture(portal, radius, halfHeight);
  const local = portalLocalPoint(point, portal);
  return Math.abs(local.x) + radius <= portal.width / 2 + MATRIX_TOLERANCE
    && Math.abs(local.y) + halfHeight <= portal.height / 2 + MATRIX_TOLERANCE;
}

/** Front-to-back crossing only; parallel and reverse trajectories never trigger. */
export function intersectMovementWithPortal(
  start: Vector3,
  end: Vector3,
  portal: Portal,
  radius = 0,
  halfHeight = 0,
): PortalCrossing | null {
  validateAperture(portal, radius, halfHeight);
  const previousDistance = computeSignedPlaneDistance(start, portal);
  const candidateDistance = computeSignedPlaneDistance(end, portal);
  const denominator = previousDistance - candidateDistance;
  if (previousDistance <= CROSSING_EPSILON || candidateDistance > 0
    || denominator <= CROSSING_EPSILON) return null;
  const t = previousDistance / denominator;
  if (!Number.isFinite(t) || t < 0 || t > 1) return null;
  const hitPoint = start.clone().lerp(end, t);
  if (!isPointInsideAperture(hitPoint, portal, radius, halfHeight)) return null;
  return {
    portalId: portal.id,
    hitPoint,
    t,
    remainingDisplacement: end.clone().sub(hitPoint),
  };
}
