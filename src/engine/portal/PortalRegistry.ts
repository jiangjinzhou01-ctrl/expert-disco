import { computePortalTransform, portalWorldMatrix } from './PortalMath';
import type { Portal, PortalLink, PortalTransformResult } from './PortalTypes';

/** Immutable connection topology; the registry never owns rendering or physics. */
export class PortalRegistry {
  private readonly portals = new Map<string, Portal>();
  private readonly links = new Map<string, string>();

  constructor(portals: readonly Portal[], links: readonly PortalLink[]) {
    for (const portal of portals) {
      if (!portal.id || !portal.worldId || this.portals.has(portal.id)) {
        throw new Error(`Invalid or duplicate portal ID: ${portal.id}`);
      }
      portalWorldMatrix(portal);
      if (!Number.isFinite(portal.width) || !Number.isFinite(portal.height)
        || portal.width <= 0 || portal.height <= 0) throw new Error('Invalid portal aperture');
      this.portals.set(portal.id, portal);
    }
    for (const link of links) {
      const source = this.get(link.sourceId);
      const destination = this.get(link.destinationId);
      if (source.worldId !== link.sourceWorldId || destination.worldId !== link.destinationWorldId
        || source.id === destination.id || this.links.has(source.id)) {
        throw new Error(`Invalid portal link: ${link.sourceId} -> ${link.destinationId}`);
      }
      this.links.set(source.id, destination.id);
    }
  }

  get(id: string): Portal {
    const portal = this.portals.get(id);
    if (!portal) throw new Error(`Unknown portal: ${id}`);
    return portal;
  }

  destination(id: string): Portal {
    const destination = this.links.get(id);
    if (!destination) throw new Error(`Unlinked portal: ${id}`);
    return this.get(destination);
  }

  transform(id: string): PortalTransformResult {
    return computePortalTransform(this.get(id), this.destination(id));
  }

  forWorld(worldId: string): Portal[] {
    return this.all().filter(portal => portal.worldId === worldId);
  }

  all(): Portal[] {
    return [...this.portals.values()];
  }
}
