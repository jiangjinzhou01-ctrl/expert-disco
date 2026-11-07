import type { Matrix4, Quaternion, Vector3 } from 'three';

/** Right handed, metre units. Local +Z faces the traversable entrance. */
export interface PortalPose {
  position: Vector3;
  rotation: Quaternion;
}

export interface Portal extends PortalPose {
  id: string;
  worldId: string;
  width: number;
  height: number;
}

export interface PortalLink {
  sourceId: string;
  destinationId: string;
  sourceWorldId: string;
  destinationWorldId: string;
}

export interface PortalTransformResult {
  matrix: Matrix4;
  rotation: Quaternion;
}

export interface PortalCrossing {
  portalId: string;
  hitPoint: Vector3;
  /** Fraction of the requested displacement consumed before the crossing. */
  t: number;
  remainingDisplacement: Vector3;
}

export type PortalTransformInput = PortalPose | Matrix4;
