const THREE = window.THREE;

export default class AuditorService {
  constructor({ scene, camera, project, editableMeshes, selectObjectFn, focusObjectFn, updateProjectFn, homelabUrl = 'http://192.168.15.2:8503' }) {
    this.scene = scene;
    this.camera = camera;
    this.project = project;
    this.editableMeshes = editableMeshes;
    this.selectObject = selectObjectFn;
    this.focusObject = focusObjectFn;
    this.updateProject = updateProjectFn;
    this.homelabUrl = homelabUrl;
    
    this.errors = [];
    this.currentErrorIndex = 0;
    this.isAuditing = false;
    
    // Sistema de aprendizado
    this.learningKey = 'trailer3d-auditor-learning-v1';
    this.learningData = this._loadLearningData();
    
    // Regras de validação por especialidade
    this.rules = {
      engineering: this._getEngineeringRules(),
      architecture: this._getArchitectureRules(),
      mechanics: this._getMechanicsRules(),
      carpentry: this._getCarpentryRules(),
      design: this._getDesignRules(),
      organization: this._getOrganizationRules()
    };
    
    // Histórico de correções
    this.correctionHistory = [];
  }
  
  _loadLearningData() {
    try {
      const data = localStorage.getItem(this.learningKey);
      return data ? JSON.parse(data) : {
        patterns: [],
        userFeedback: [],
        corrections: [],
        successRate: 0
      };
    } catch (e) {
      console.error('Erro ao carregar dados de aprendizado:', e);
      return { patterns: [], userFeedback: [], corrections: [], successRate: 0 };
    }
  }
  
  _saveLearningData() {
    try {
      localStorage.setItem(this.learningKey, JSON.stringify(this.learningData));
    } catch (e) {
      console.error('Erro ao salvar dados de aprendizado:', e);
    }
  }
  
  _getEngineeringRules() {
    return [
      {
        id: 'eng-001',
        category: 'Estrutural',
        severity: 'critical',
        description: 'Verificar integridade estrutural do chassi',
        check: (proj) => {
          const chassis = proj.dimensions?.chassis;
          if (!chassis) return { valid: false, message: 'Chassi não definido' };
          if (chassis.L < 2.5 || chassis.L > 4.0) return { valid: false, message: `Comprimento do chassi (${chassis.L}m) fora do padrão (2.5-4.0m)` };
          if (chassis.W < 1.2 || chassis.W > 2.0) return { valid: false, message: `Largura do chassi (${chassis.W}m) fora do padrão (1.2-2.0m)` };
          return { valid: true };
        }
      },
      {
        id: 'eng-002',
        category: 'Peso',
        severity: 'warning',
        description: 'Verificar distribuição de peso',
        check: (proj) => {
          const weights = proj.weights_kg;
          if (!weights) return { valid: false, message: 'Pesos não definidos' };
          const total = Object.values(weights).reduce((a, b) => a + b, 0) - (weights.pbt_limit || 0) - (weights.warn_threshold || 0);
          if (total > (weights.pbt_limit || 750)) return { valid: false, message: `Peso total (${total}kg) excede limite PBT (${weights.pbt_limit}kg)` };
          if (total > (weights.warn_threshold || 600)) return { valid: true, message: `Peso total (${total}kg) próximo do limite de aviso (${weights.warn_threshold}kg)`, warning: true };
          return { valid: true };
        }
      },
      {
        id: 'eng-003',
        category: 'Estabilidade',
        severity: 'critical',
        description: 'Verificar centro de gravidade',
        check: (proj) => {
          const body = proj.dimensions?.body;
          const chassis = proj.dimensions?.chassis;
          if (!body || !chassis) return { valid: false, message: 'Dimensões não definidas' };
          if (body.H > 2.2) return { valid: false, message: `Altura da caixa (${body.H}m) pode comprometer estabilidade` };
          return { valid: true };
        }
      }
    ];
  }
  
  _getArchitectureRules() {
    return [
      {
        id: 'arch-001',
        category: 'Espaço Interno',
        severity: 'warning',
        description: 'Verificar ergonomia do espaço interno',
        check: (proj) => {
          const interior = proj.dimensions?.interior;
          if (!interior) return { valid: false, message: 'Dimensões internas não definidas' };
          if (interior.H < 1.7) return { valid: false, message: `Altura interna (${interior.H}m) abaixo do mínimo ergonômico (1.7m)` };
          if (interior.W < 1.5) return { valid: false, message: `Largura interna (${interior.W}m) abaixo do mínimo confortável (1.5m)` };
          return { valid: true };
        }
      },
      {
        id: 'arch-002',
        category: 'Circulação',
        severity: 'warning',
        description: 'Verificar corredores de circulação',
        check: (proj) => {
          const interior = proj.dimensions?.interior;
          if (!interior) return { valid: false, message: 'Dimensões internas não definidas' };
          // Verificar se há espaço mínimo para circulação
          const minCorridor = 0.5; // 50cm mínimo
          if (interior.W < 1.8) return { valid: true, message: 'Largura interna limitada, verificar corredores', warning: true };
          return { valid: true };
        }
      },
      {
        id: 'arch-003',
        category: 'Banheiro',
        severity: 'warning',
        description: 'Verificar dimensões do banheiro',
        check: (proj) => {
          const bath = proj.dimensions?.bath_cube;
          if (!bath) return { valid: true, message: 'Banheiro não definido (opcional)' };
          if (bath.W < 0.7) return { valid: false, message: `Largura do banheiro (${bath.W}m) abaixo do mínimo (0.7m)` };
          if (bath.H < 1.8) return { valid: false, message: `Altura do banheiro (${bath.H}m) abaixo do mínimo (1.8m)` };
          return { valid: true };
        }
      }
    ];
  }
  
  _getMechanicsRules() {
    return [
      {
        id: 'mec-001',
        category: 'Rodas',
        severity: 'critical',
        description: 'Verificar especificação das rodas',
        check: (proj) => {
          const weights = proj.weights_kg;
          if (!weights) return { valid: false, message: 'Pesos não definidos' };
          if (!weights.wheels) return { valid: false, message: 'Peso das rodas não especificado' };
          if (weights.wheels < 10 || weights.wheels > 25) return { valid: false, message: `Peso das rodas (${weights.wheels}kg) fora do padrão (10-25kg)` };
          return { valid: true };
        }
      },
      {
        id: 'mec-002',
        category: 'Engate',
        severity: 'critical',
        description: 'Verificar altura do engate',
        check: (proj) => {
          const chassis = proj.dimensions?.chassis;
          if (!chassis) return { valid: false, message: 'Chassi não definido' };
          // Altura padrão de engate: 40-50cm do solo
          return { valid: true, message: 'Verificar altura do engate manualmente (40-50cm do solo)', warning: true };
        }
      }
    ];
  }
  
  _getCarpentryRules() {
    return [
      {
        id: 'carp-001',
        category: 'Materiais',
        severity: 'warning',
        description: 'Verificar espessura de materiais',
        check: (proj) => {
          const wallThickness = proj.dimensions?.wall_thickness;
          if (!wallThickness) return { valid: false, message: 'Espessura das paredes não definida' };
          if (wallThickness < 0.015) return { valid: false, message: `Espessura das paredes (${wallThickness * 1000}mm) abaixo do mínimo (15mm)` };
          if (wallThickness > 0.025) return { valid: true, message: `Espessura das paredes (${wallThickness * 1000}mm) acima do padrão, pode aumentar peso`, warning: true };
          return { valid: true };
        }
      },
      {
        id: 'carp-002',
        category: 'Corte',
        severity: 'info',
        description: 'Verificar otimização de corte',
        check: (proj) => {
          const geometry = proj.geometry;
          if (!geometry || !geometry.parts) return { valid: true, message: 'Geometria em formato parts não disponível para análise de corte' };
          return { valid: true, message: 'Análise de corte disponível via serviço /cut-plan' };
        }
      },
      {
        id: 'carp-003',
        category: 'Montagem',
        severity: 'warning',
        description: 'Verificar folgas de montagem',
        check: (proj) => {
          const interior = proj.dimensions?.interior;
          const body = proj.dimensions?.body;
          if (!interior || !body) return { valid: false, message: 'Dimensões não definidas' };
          const wallThickness = proj.dimensions?.wall_thickness || 0.05;
          const expectedInteriorW = body.W - (2 * wallThickness);
          const expectedInteriorL = body.L - (2 * wallThickness);
          
          if (Math.abs(interior.W - expectedInteriorW) > 0.01) {
            return { valid: false, message: `Inconsistência na largura interna: esperado ${expectedInteriorW.toFixed(2)}m, definido ${interior.W}m` };
          }
          if (Math.abs(interior.L - expectedInteriorL) > 0.01) {
            return { valid: false, message: `Inconsistência no comprimento interno: esperado ${expectedInteriorL.toFixed(2)}m, definido ${interior.L}m` };
          }
          return { valid: true };
        }
      }
    ];
  }
  
  _getDesignRules() {
    return [
      {
        id: 'des-001',
        category: 'Estética',
        severity: 'info',
        description: 'Verificar proporções e harmonia',
        check: (proj) => {
          const body = proj.dimensions?.body;
          if (!body) return { valid: false, message: 'Dimensões do corpo não definidas' };
          const ratio = body.L / body.W;
          if (ratio < 1.2 || ratio > 2.5) return { valid: true, message: `Proporção L/W (${ratio.toFixed(2)}) fora da faixa harmoniosa (1.2-2.5)`, warning: true };
          return { valid: true };
        }
      },
      {
        id: 'des-002',
        category: 'Funcionalidade',
        severity: 'warning',
        description: 'Verificar posicionamento de portas e janelas',
        check: (proj) => {
          if (!proj.structure?.openings) return { valid: true, message: 'Aberturas não definidas no projeto' };
          // Verificar se há porta de entrada
          const hasDoor = Object.values(proj.structure.openings).some(openings => 
            openings.some(o => o.type === 'door')
          );
          if (!hasDoor) return { valid: false, message: 'Nenhuma porta de entrada encontrada' };
          return { valid: true };
        }
      },
      {
        id: 'des-003',
        category: 'Acessibilidade',
        severity: 'warning',
        description: 'Verificar acessibilidade',
        check: (proj) => {
          const door = proj.dimensions?.door_external;
          if (!door) return { valid: true, message: 'Porta externa não definida' };
          if (door.W < 0.6) return { valid: false, message: `Largura da porta (${door.W}m) abaixo do mínimo acessível (0.6m)` };
          if (door.H < 1.5) return { valid: false, message: `Altura da porta (${door.H}m) abaixo do mínimo (1.5m)` };
          return { valid: true };
        }
      }
    ];
  }

  _getOrganizationRules() {
    return [
      {
        id: 'org-001',
        category: 'Nomenclatura',
        severity: 'critical',
        description: 'Verificar nomes genéricos de objetos',
        check: (proj) => {
          if (!proj.scene_layout?.objects) return { valid: true, message: 'Scene layout não definido' };
          
          const genericNames = ['Objeto Interior', 'Object', 'Object Interior', 'Generic Object'];
          const genericObjects = proj.scene_layout.objects.filter(obj => 
            genericNames.includes(obj.name)
          );
          
          if (genericObjects.length > 0) {
            return { 
              valid: false, 
              message: `${genericObjects.length} objetos com nomes genéricos encontrados (ex: "Objeto Interior")`,
              count: genericObjects.length
            };
          }
          return { valid: true };
        }
      },
      {
        id: 'org-002',
        category: 'Estrutura',
        severity: 'warning',
        description: 'Verificar duplicação de objetos',
        check: (proj) => {
          if (!proj.scene_layout?.objects) return { valid: true, message: 'Scene layout não definido' };
          
          const positions = new Map();
          const duplicates = [];
          
          proj.scene_layout.objects.forEach((obj, index) => {
            if (obj.p) {
              const posKey = `${obj.p[0].toFixed(2)},${obj.p[1].toFixed(2)},${obj.p[2].toFixed(2)}`;
              if (positions.has(posKey)) {
                duplicates.push({ index, position: posKey, originalIndex: positions.get(posKey) });
              } else {
                positions.set(posKey, index);
              }
            }
          });
          
          if (duplicates.length > 0) {
            return { 
              valid: false, 
              message: `${duplicates.length} objetos em posições duplicadas encontrados`,
              count: duplicates.length
            };
          }
          return { valid: true };
        }
      }
    ];
  }
  
  async auditProject() {
    this.isAuditing = true;
    this.errors = [];
    this.currentErrorIndex = 0;
    
    console.log('Iniciando auditoria do projeto...');
    
    // Executar todas as regras
    for (const [category, rules] of Object.entries(this.rules)) {
      for (const rule of rules) {
        try {
          const result = rule.check(this.project);
          if (!result.valid || result.warning) {
            this.errors.push({
              id: rule.id,
              category: category,
              ruleCategory: rule.category,
              severity: rule.severity,
              description: rule.description,
              message: result.message,
              valid: result.valid,
              warning: result.warning || false,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error(`Erro ao executar regra ${rule.id}:`, e);
          this.errors.push({
            id: rule.id,
            category: category,
            ruleCategory: rule.category,
            severity: 'error',
            description: rule.description,
            message: `Erro na validação: ${e.message}`,
            valid: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    // Adicionar aprendizado do histórico
    this._applyLearningPatterns();
    
    this.isAuditing = false;
    console.log(`Auditoria concluída: ${this.errors.length} problemas encontrados`);
    
    return this.errors;
  }
  
  _applyLearningPatterns() {
    // Aplicar padrões aprendidos com feedback anterior
    const patterns = this.learningData.patterns || [];
    patterns.forEach(pattern => {
      if (pattern.confidence > 0.7) {
        // Adicionar verificação baseada em padrão aprendido
        this.errors.push({
          id: `learn-${pattern.id}`,
          category: 'learned',
          ruleCategory: 'Aprendizado',
          severity: pattern.severity,
          description: pattern.description,
          message: pattern.message,
          valid: false,
          learned: true,
          confidence: pattern.confidence,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  getNextError() {
    if (this.currentErrorIndex >= this.errors.length) {
      return null; // Todos os erros foram processados
    }
    
    const error = this.errors[this.currentErrorIndex];
    this.currentErrorIndex++;
    
    return error;
  }
  
  focusOnError(error) {
    // Tentar identificar e focar no objeto relacionado ao erro
    let targetMesh = null;
    
    // Buscar mesh relacionada ao erro
    if (error.category === 'engineering' || error.category === 'mechanics') {
      // Focar no chassi
      targetMesh = this.editableMeshes.find(m => m.userData?.type === 'chassis');
    } else if (error.category === 'architecture') {
      // Focar no corpo
      targetMesh = this.editableMeshes.find(m => m.userData?.type === 'body');
    } else if (error.category === 'carpentry') {
      // Focar nas paredes
      targetMesh = this.editableMeshes.find(m => m.userData?.type === 'wall');
    }
    
    if (targetMesh) {
      this.selectObject(targetMesh);
      this.focusObject(targetMesh);
      return targetMesh;
    }
    
    return null;
  }
  
  async suggestCorrection(error) {
    // Usar endpoint local com integração ao homelab
    try {
      const response = await fetch('/audit/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error,
          project: this.project,
          context: this._getContext()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.suggestion;
      }
    } catch (e) {
      console.error('Erro ao obter sugestão do serviço de correção:', e);
    }
    
    // Fallback: sugestão baseada em regras locais
    return this._getLocalSuggestion(error);
  }
  
  _getContext() {
    return {
      errors: this.errors,
      currentErrorIndex: this.currentErrorIndex,
      learningData: this.learningData
    };
  }
  
  _getLocalSuggestion(error) {
    const suggestions = {
      'eng-001': 'Ajustar dimensões do chassi para dentro do padrão (L: 2.5-4.0m, W: 1.2-2.0m)',
      'eng-002': 'Reduzir peso de componentes ou aumentar limite PBT',
      'eng-003': 'Reduzir altura da caixa ou reposicionar componentes pesados',
      'arch-001': 'Aumentar altura interna mínima para 1.7m',
      'arch-002': 'Aumentar largura interna ou reorganizar layout',
      'arch-003': 'Ajustar dimensões do banheiro (W: >=0.7m, H: >=1.8m)',
      'mec-001': 'Verificar especificação das rodas (10-25kg)',
      'mec-002': 'Ajustar altura do engate para 40-50cm do solo',
      'carp-001': 'Ajustar espessura das paredes para 15-25mm',
      'carp-002': 'Usar serviço /cut-plan para otimização',
      'carp-003': 'Corrigir inconsistência nas dimensões internas',
      'des-001': 'Ajustar proporções para melhor harmonia visual',
      'des-002': 'Adicionar porta de entrada se não existir',
      'des-003': 'Aumentar largura da porta para mínimo 0.6m'
    };
    
    return suggestions[error.id] || 'Revisar parâmetros relacionados ao erro';
  }
  
  async applyCorrection(error, correction) {
    try {
      // Aplicar correção no projeto
      const updatedProject = this._applyCorrectionToProject(error, correction);
      
      // Atualizar projeto
      if (this.updateProject) {
        await this.updateProject(updatedProject);
      }
      
      // Registrar correção no histórico
      this.correctionHistory.push({
        error: error,
        correction: correction,
        timestamp: new Date().toISOString(),
        success: true
      });
      
      return { success: true, project: updatedProject };
    } catch (e) {
      console.error('Erro ao aplicar correção:', e);
      this.correctionHistory.push({
        error: error,
        correction: correction,
        timestamp: new Date().toISOString(),
        success: false,
        error: e.message
      });
      return { success: false, error: e.message };
    }
  }
  
  _applyCorrectionToProject(error, correction) {
    const updatedProject = JSON.parse(JSON.stringify(this.project));
    
    // Lógica de correção baseada no tipo de erro
    switch (error.id) {
      case 'eng-001':
        if (updatedProject.dimensions?.chassis) {
          updatedProject.dimensions.chassis.L = Math.max(2.5, Math.min(4.0, updatedProject.dimensions.chassis.L));
          updatedProject.dimensions.chassis.W = Math.max(1.2, Math.min(2.0, updatedProject.dimensions.chassis.W));
        }
        break;
      case 'eng-002':
        if (updatedProject.weights_kg) {
          updatedProject.weights_kg.warn_threshold = Math.max(600, updatedProject.weights_kg.warn_threshold || 600);
        }
        break;
      case 'arch-001':
        if (updatedProject.dimensions?.interior) {
          updatedProject.dimensions.interior.H = Math.max(1.7, updatedProject.dimensions.interior.H);
        }
        break;
      case 'carp-001':
        if (updatedProject.dimensions) {
          updatedProject.dimensions.wall_thickness = 0.015;
        }
        break;
      // Adicionar mais casos conforme necessário
    }
    
    return updatedProject;
  }
  
  recordFeedback(error, approved, comment = '') {
    // Registrar feedback do usuário
    this.learningData.userFeedback.push({
      error: error,
      approved: approved,
      comment: comment,
      timestamp: new Date().toISOString()
    });
    
    // Atualizar padrões de aprendizado
    if (approved) {
      this._updateLearningPattern(error, true);
    } else {
      this._updateLearningPattern(error, false);
    }
    
    // Calcular taxa de sucesso
    this._calculateSuccessRate();
    
    // Salvar dados de aprendizado
    this._saveLearningData();
  }
  
  _updateLearningPattern(error, success) {
    const existingPattern = this.learningData.patterns.find(p => p.id === error.id);
    
    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.successCount += success ? 1 : 0;
      existingPattern.confidence = existingPattern.successCount / existingPattern.occurrences;
    } else {
      this.learningData.patterns.push({
        id: error.id,
        description: error.description,
        message: error.message,
        severity: error.severity,
        occurrences: 1,
        successCount: success ? 1 : 0,
        confidence: success ? 1 : 0,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  _calculateSuccessRate() {
    const feedback = this.learningData.userFeedback;
    if (feedback.length === 0) {
      this.learningData.successRate = 0;
      return;
    }
    
    const approvedCount = feedback.filter(f => f.approved).length;
    this.learningData.successRate = approvedCount / feedback.length;
  }
  
  getLearningStats() {
    return {
      totalPatterns: this.learningData.patterns.length,
      totalFeedback: this.learningData.userFeedback.length,
      successRate: this.learningData.successRate,
      topPatterns: this.learningData.patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
    };
  }
  
  getErrorsSummary() {
    const summary = {
      total: this.errors.length,
      critical: this.errors.filter(e => e.severity === 'critical').length,
      warning: this.errors.filter(e => e.severity === 'warning').length,
      info: this.errors.filter(e => e.severity === 'info').length,
      byCategory: {}
    };
    
    this.errors.forEach(error => {
      if (!summary.byCategory[error.category]) {
        summary.byCategory[error.category] = 0;
      }
      summary.byCategory[error.category]++;
    });
    
    return summary;
  }
  
  resetAudit() {
    this.errors = [];
    this.currentErrorIndex = 0;
    this.isAuditing = false;
  }
}