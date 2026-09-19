import type { FabricModule, FabricObject } from './types';
import { isTextObject } from './textStyle';

export function isPbEditableCanvasText(obj: FabricObject): boolean {
  if (!isTextObject(obj)) return false;
  const tagged = obj as FabricObject & { pbKind?: string };
  return tagged.pbKind !== 'emoji';
}

export function isTextEditing(obj: FabricObject): boolean {
  return !!(obj as FabricObject & { isEditing?: boolean }).isEditing;
}

/**
 * Canva-style IText clicks for photobook canvas text:
 * - Double-click enters edit mode and selects all text
 * - A follow-up single click places the caret (Fabric default mousedown handler)
 */
export function setupPbTextEditingBehavior(fabric: FabricModule) {
  const IText = fabric.IText;
  if (!IText?.prototype) return;

  const proto = IText.prototype as unknown as {
    _pbTextEditingPatched?: boolean;
    editable?: boolean;
    isEditing?: boolean;
    canvas?: {
      setActiveObject: (obj: unknown) => void;
      requestRenderAll: () => void;
    };
    enterEditing?: (e?: Event) => void;
    selectAll?: () => void;
    renderCursorOrSelection?: () => void;
    doubleClickHandler?: (options: { e?: Event }) => void;
    pbKind?: string;
    type?: string;
  };

  if (proto._pbTextEditingPatched) return;
  proto._pbTextEditingPatched = true;

  proto.doubleClickHandler = function (options: { e?: Event }) {
    if (!this.editable || !this.canvas || !isPbEditableCanvasText(this as FabricObject)) return;

    if (!this.isEditing) {
      this.canvas.setActiveObject(this);
      this.enterEditing?.(options.e);
    }

    this.selectAll?.();
    this.renderCursorOrSelection?.();
    this.canvas.requestRenderAll();
  };
}
