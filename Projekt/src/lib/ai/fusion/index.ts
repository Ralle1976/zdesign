// Z.Design - Fusion Pipeline Barrel Export
// Multi-model panel -> judge -> synthesis engine.

export { FusionPipeline, FusionUnavailableError } from './fusion-pipeline';
export type { FusionRunInput, FusionResult, FusionStageInfo } from './fusion-pipeline';
export { callRemoteFusion, RemoteFusionError } from './remote-fusion';
export type { RemoteFusionInput, RemoteFusionResult } from './remote-fusion';

export {
  ProposalSchema,
  FusionDirectiveSchema,
  DesignNodeSchema,
  parseDesignNode,
  type Proposal,
  type FusionDirective,
  type DesignNodeLike,
} from './schemas';

export {
  PERSONA_MODEL_MAP,
  resolvePersonaProvider,
  personaPreferredModel,
  describeRouting,
  type PersonaRole,
} from './persona-routing';

export {
  deriveDesignDirection,
  directiveToPromptBlock,
  directiveLabel,
  type DesignDirective,
  type DesignPalette,
} from './design-direction';
