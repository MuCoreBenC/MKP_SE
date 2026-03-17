import { ParamEditorService } from '../services/param-editor-service';

export class ParamsController {
  public constructor(private readonly paramEditorService: ParamEditorService) {}

  public loadEditor(presetPath: string, snapshot: Record<string, unknown>) {
    return this.paramEditorService.loadPreset(presetPath, snapshot);
  }

  public saveEditor() {
    return this.paramEditorService.save();
  }
}
