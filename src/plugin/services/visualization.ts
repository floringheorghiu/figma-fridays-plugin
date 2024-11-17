import { DocumentationChunk } from '../../types/documentation';
import { InteractionData, ScreenInteractions } from '../../types/interaction-types';
import { CONFIG } from '../../constants';

export class VisualizationService {
  async createDocumentationNodes(chunks: DocumentationChunk[]) {
    try {
      // Create documentation page
      const docPage = figma.createPage();
      docPage.name = `Documentation - ${new Date().toLocaleString()}`;
      
      // Create main container frame
      const frame = this.createMainFrame();
      
      // Group and sort interactions by screen
      const screenGroups = this.groupInteractionsByScreen(chunks);
      
      // Create title and content
      await this.createTitle(frame, screenGroups);
      await this.createScreenSections(frame, screenGroups);

      // Add to page and focus
      docPage.appendChild(frame);
      figma.currentPage = docPage;
      figma.viewport.scrollAndZoomIntoView([frame]);
      
    } catch (error) {
      console.error('Error creating documentation:', error);
      throw error;
    }
  }

  private createMainFrame(): FrameNode {
    const frame = figma.createFrame();
    frame.name = 'Documentation';
    frame.resize(CONFIG.FRAME_WIDTH, CONFIG.FRAME_HEIGHT);
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    frame.cornerRadius = 8;
    frame.layoutMode = 'VERTICAL';
    frame.paddingLeft = CONFIG.PADDING;
    frame.paddingRight = CONFIG.PADDING;
    frame.paddingTop = CONFIG.PADDING;
    frame.paddingBottom = CONFIG.PADDING;
    frame.itemSpacing = CONFIG.SPACING;
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'FIXED';
    return frame;
  }

  private async createTitle(frame: FrameNode, screenGroups: ScreenInteractions[]): Promise<void> {
    const totalInteractions = screenGroups.reduce((sum, group) => sum + group.totalInteractions, 0);
    const titleText = await this.createText(
      `Screen Interactions (${totalInteractions} total)`,
      16,
      true
    );
    frame.appendChild(titleText);

    const divider = figma.createFrame();
    divider.resize(frame.width - (2 * CONFIG.PADDING), 1);
    divider.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    frame.appendChild(divider);
  }

  private async createScreenSections(frame: FrameNode, screenGroups: ScreenInteractions[]): Promise<void> {
    for (const screen of screenGroups) {
      const screenSection = figma.createFrame();
      screenSection.layoutMode = 'VERTICAL';
      screenSection.itemSpacing = 12;
      screenSection.fills = [];
      screenSection.paddingLeft = 0;
      screenSection.paddingRight = 0;
      screenSection.paddingTop = 16;
      screenSection.paddingBottom = 16;
      screenSection.primaryAxisSizingMode = 'AUTO';
      screenSection.counterAxisSizingMode = 'AUTO';

      // Screen header
      const headerSection = figma.createFrame();
      headerSection.layoutMode = 'HORIZONTAL';
      headerSection.itemSpacing = 8;
      headerSection.fills = [];
      headerSection.primaryAxisSizingMode = 'AUTO';
      headerSection.counterAxisSizingMode = 'AUTO';

      const screenName = await this.createText(screen.screenName, 14, true);
      const interactionCount = await this.createText(
        `(${screen.totalInteractions} interaction${screen.totalInteractions === 1 ? '' : 's'})`,
        14,
        false
      );
      interactionCount.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];

      headerSection.appendChild(screenName);
      headerSection.appendChild(interactionCount);
      screenSection.appendChild(headerSection);

      // Group interactions by element
      const elementGroups = this.groupInteractionsByElement(screen.interactions);
      
      for (const [elementName, interactions] of elementGroups) {
        const elementSection = await this.createElementSection(elementName, interactions);
        screenSection.appendChild(elementSection);
      }

      frame.appendChild(screenSection);

      // Add divider if not last screen
      if (screen !== screenGroups[screenGroups.length - 1]) {
        const divider = figma.createFrame();
        divider.resize(frame.width - (2 * CONFIG.PADDING), 1);
        divider.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
        frame.appendChild(divider);
      }
    }
  }

  private async createElementSection(elementName: string, interactions: InteractionData[]): Promise<FrameNode> {
    const section = figma.createFrame();
    section.layoutMode = 'VERTICAL';
    section.itemSpacing = 8;
    section.fills = [];
    section.paddingLeft = 24;
    section.primaryAxisSizingMode = 'AUTO';
    section.counterAxisSizingMode = 'AUTO';

    // Element name with interaction count
    const elementHeader = await this.createText(
      `${elementName} (${interactions.length} interaction${interactions.length === 1 ? '' : 's'})`,
      12,
      true,
      true
    );
    elementHeader.fills = [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1 } }];
    section.appendChild(elementHeader);

    // Interaction list
    for (const interaction of interactions) {
      const description = await this.createText(
        this.formatInteraction(interaction),
        11,
        false
      );
      description.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
      section.appendChild(description);
    }

    return section;
  }

  private formatInteraction(interaction: InteractionData): string {
    const trigger = this.normalizeTrigger(interaction.trigger);
    const action = interaction.destination || 
                  (interaction.destinationId ? 
                    figma.getNodeById(interaction.destinationId)?.name : 
                    this.normalizeAction(interaction.action));

    let description = `${trigger} → ${action}`;
    
    if (interaction.metadata?.delay) {
      description += ` (after ${interaction.metadata.delay}ms)`;
    }
    
    return description;
  }

  private async createText(
    content: string, 
    size: number, 
    isBold: boolean = false,
    isLink: boolean = false
  ): Promise<TextNode> {
    const text = figma.createText();
    await figma.loadFontAsync({ 
      family: "Inter", 
      style: isBold ? "Bold" : "Regular" 
    });
    text.fontName = { 
      family: "Inter", 
      style: isBold ? "Bold" : "Regular" 
    };
    text.fontSize = size;
    text.characters = content;

    if (isLink) {
      text.textDecoration = 'UNDERLINE';
    }

    return text;
  }

  private groupInteractionsByScreen(chunks: DocumentationChunk[]): ScreenInteractions[] {
    const screenMap = new Map<string, ScreenInteractions>();

    chunks.forEach(chunk => {
      const parentFrame = this.findParentFrame(chunk.nodeId);
      if (!parentFrame) return;

      const screenId = parentFrame.id;
      if (!screenMap.has(screenId)) {
        screenMap.set(screenId, {
          screenId,
          screenName: parentFrame.name,
          interactions: [],
          totalInteractions: 0
        });
      }

      const screenGroup = screenMap.get(screenId)!;
      chunk.interactions.forEach(interaction => {
        screenGroup.interactions.push({
          elementName: chunk.name,
          nodeName: chunk.name,
          nodeId: chunk.nodeId,
          trigger: interaction.trigger,
          action: interaction.action,
          destination: interaction.actionMetadata?.destination,
          destinationId: interaction.actionMetadata?.destinationId,
          metadata: interaction.metadata,
          screen: {
            screenId: parentFrame.id,
            screenName: parentFrame.name,
            elementId: chunk.nodeId,
            elementName: chunk.name,
            parentPath: this.getNodePath(chunk.nodeId)
          }
        });
      });
      screenGroup.totalInteractions = screenGroup.interactions.length;
    });

    return Array.from(screenMap.values())
      .sort((a, b) => a.screenName.localeCompare(b.screenName));
  }

  private groupInteractionsByElement(interactions: InteractionData[]): Map<string, InteractionData[]> {
    const elementMap = new Map<string, InteractionData[]>();
    
    interactions.forEach(interaction => {
      const key = interaction.elementName;
      if (!elementMap.has(key)) {
        elementMap.set(key, []);
      }
      elementMap.get(key)!.push(interaction);
    });

    return new Map([...elementMap.entries()].sort());
  }

  private findParentFrame(nodeId: string): SceneNode | null {
    const node = figma.getNodeById(nodeId);
    if (!node) return null;

    let current: BaseNode | null = node;
    while (current && 'parent' in current) {
      if (this.isMainFrame(current)) {
        return current as SceneNode;
      }
      current = current.parent;
    }
    return null;
  }

  private isMainFrame(node: BaseNode): boolean {
    if (!('type' in node)) return false;
    const sceneNode = node as SceneNode;
    return sceneNode.type === 'FRAME' && 
           sceneNode.parent?.type === 'PAGE' &&
           !this.isComponentOrTemplate(sceneNode.name);
  }

  private isComponentOrTemplate(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes('component') || 
           lowerName.includes('template') ||
           lowerName.includes('master');
  }

  private getNodePath(nodeId: string): string[] {
    const path: string[] = [];
    let current = figma.getNodeById(nodeId);

    while (current && 'parent' in current) {
      if (this.isMainFrame(current)) break;
      path.unshift(current.name);
      current = current.parent;
    }

    return path;
  }

  private normalizeTrigger(trigger: string): string {
    const triggerMap: Record<string, string> = {
      'ON_CLICK': 'On tap',
      'AFTER_TIMEOUT': 'After delay',
      'MOUSE_ENTER': 'On hover',
      'ON_HOVER': 'On hover',
      'WHILE_HOVER': 'While hovering',
      'ON_DRAG': 'On drag',
      'KEY_DOWN': 'On key press'
    };
    return triggerMap[trigger] || trigger;
  }

  private normalizeAction(action: string): string {
    const actionMap: Record<string, string> = {
      'NAVIGATE': 'Navigate',
      'NODE': 'Navigate to',
      'BACK': 'Go back',
      'CLOSE': 'Close',
      'OPEN_URL': 'Open URL',
      'SWAP': 'Swap with',
      'OVERLAY': 'Show overlay',
      'SMART_ANIMATE': 'Animate to'
    };
    return actionMap[action] || action;
  }
}