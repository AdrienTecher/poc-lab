import { useState, useEffect, useMemo, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  BANQUE DE QUESTIONS — 70 questions, 6 domaines                     */
/*  Format : { cat, q, options[4], answer (index), exp }               */
/* ------------------------------------------------------------------ */

const QUESTIONS = [
  /* ====================  GÉNÉRALITÉS & CLASSIFICATION  ==================== */
  {
    cat: "gen",
    q: `Que signifie l'acronyme « TND » ?`,
    options: [
      `Troubles neuro-dégénératifs`,
      `Troubles du neurodéveloppement`,
      `Troubles non diagnostiqués`,
      `Troubles de la nutrition et de la digestion`,
    ],
    answer: 1,
    exp: `Les TND (troubles du neurodéveloppement) regroupent des troubles qui apparaissent durant la période développementale et affectent le fonctionnement du cerveau : cognition, langage, motricité, comportement.`,
  },
  {
    cat: "gen",
    q: `Quelle classification (édition de 2013) a introduit la catégorie des troubles neurodéveloppementaux ?`,
    options: [`La CIM-10`, `Le DSM-5`, `Le programme PISA`, `La CIM-9`],
    answer: 1,
    exp: `Le DSM-5 (Manuel diagnostique et statistique, APA, 2013) a créé la catégorie « troubles neurodéveloppementaux ». La CIM-11 de l'OMS, en vigueur depuis 2022, adopte une logique proche.`,
  },
  {
    cat: "gen",
    q: `À quelle période de la vie les TND débutent-ils, par définition ?`,
    options: [
      `À l'âge adulte`,
      `Pendant la période développementale (l'enfance)`,
      `Après 65 ans`,
      `Indifféremment à tout âge`,
    ],
    answer: 1,
    exp: `Par définition, les TND se manifestent tôt, durant le développement, souvent avant l'entrée à l'école — même si le diagnostic peut être posé bien plus tard.`,
  },
  {
    cat: "gen",
    q: `Lequel de ces troubles ne fait PAS partie des TND au sens du DSM-5 ?`,
    options: [
      `Le trouble du spectre de l'autisme`,
      `Le TDAH`,
      `La schizophrénie`,
      `Le trouble spécifique des apprentissages`,
    ],
    answer: 2,
    exp: `La schizophrénie est un trouble psychotique, pas un TND. Les TND incluent TSA, TDAH, trouble du développement intellectuel, troubles de la communication, troubles des apprentissages et troubles moteurs.`,
  },
  {
    cat: "gen",
    q: `Les différents TND sont, le plus souvent…`,
    options: [
      `isolés, sans aucun autre trouble associé`,
      `associés entre eux (comorbidités)`,
      `exclusivement d'origine génétique`,
      `toujours visibles à l'imagerie cérébrale`,
    ],
    answer: 1,
    exp: `Les comorbidités sont la règle plus que l'exception : un enfant TDAH peut aussi présenter un trouble « dys », un enfant autiste un TDAH, etc.`,
  },
  {
    cat: "gen",
    q: `Comment pose-t-on le diagnostic d'un TND ?`,
    options: [
      `Par une simple prise de sang`,
      `Par un scanner cérébral systématique`,
      `Par une évaluation clinique pluridisciplinaire`,
      `Par un test génétique unique`,
    ],
    answer: 2,
    exp: `Il n'existe pas de marqueur biologique unique. Le diagnostic repose sur l'observation clinique, des bilans (neuropsychologique, orthophonique…) et des critères standardisés.`,
  },
  {
    cat: "gen",
    q: `En France, quelle structure coordonne le repérage et l'intervention précoce des TND chez le jeune enfant ?`,
    options: [
      `La CAF`,
      `La plateforme de coordination et d'orientation (PCO)`,
      `Pôle emploi`,
      `La préfecture`,
    ],
    answer: 1,
    exp: `Les PCO TND organisent un parcours de bilan et d'intervention précoce (d'abord 0-6 ans, étendu jusqu'à 12 ans) sans attendre qu'un diagnostic soit posé.`,
  },
  {
    cat: "gen",
    q: `Le sex-ratio des diagnostics de TSA et de TDAH est…`,
    options: [
      `parfaitement équilibré entre filles et garçons`,
      `en faveur d'un diagnostic plus fréquent chez les garçons`,
      `de 10 filles pour 1 garçon`,
      `inexistant`,
    ],
    answer: 1,
    exp: `Les garçons sont diagnostiqués plus souvent, mais le sous-diagnostic des filles (camouflage, présentations différentes) est de mieux en mieux reconnu.`,
  },
  {
    cat: "gen",
    q: `« Neurodéveloppemental » signifie que le trouble est lié…`,
    options: [
      `à un traumatisme psychologique récent`,
      `au développement du système nerveux`,
      `à un manque de sommeil passager`,
      `à une mauvaise alimentation uniquement`,
    ],
    answer: 1,
    exp: `Le terme renvoie à des particularités d'installation et de fonctionnement du cerveau au cours du développement, d'origine surtout neurobiologique.`,
  },
  {
    cat: "gen",
    q: `Le QI (quotient intellectuel) moyen dans la population est fixé par convention à…`,
    options: [`50`, `100`, `130`, `200`],
    answer: 1,
    exp: `Les échelles de QI sont étalonnées sur une moyenne de 100 et un écart-type de 15. Un trouble du développement intellectuel correspond généralement à un QI < 70 associé à des limitations adaptatives.`,
  },
  {
    cat: "gen",
    q: `Le « haut potentiel intellectuel » (HPI) est-il un trouble du neurodéveloppement ?`,
    options: [
      `Oui, c'est un TND officiel`,
      `Non, ce n'est pas un trouble`,
      `Oui, il figure dans le DSM-5`,
      `C'est une maladie neurologique`,
    ],
    answer: 1,
    exp: `Le HPI (souvent QI ≥ 130) n'est ni une pathologie ni un TND. Il peut toutefois coexister avec un TND : on parle alors de « double exceptionnalité ».`,
  },
  {
    cat: "gen",
    q: `Quelle affirmation est exacte concernant les TND ?`,
    options: [
      `Ils disparaissent toujours à l'âge adulte`,
      `Ils résultent d'un mauvais accompagnement parental`,
      `Ils sont durables, mais l'accompagnement améliore le fonctionnement`,
      `Ils se soignent par un traitement unique`,
    ],
    answer: 2,
    exp: `Les TND sont des particularités durables. Rééducations, aménagements et parfois traitements n'effacent pas le trouble, mais réduisent le retentissement et soutiennent le développement.`,
  },

  /* ====================  SPECTRE DE L'AUTISME (TSA)  ==================== */
  {
    cat: "tsa",
    q: `Que signifie « TSA » ?`,
    options: [
      `Trouble sensoriel aigu`,
      `Trouble du spectre de l'autisme`,
      `Trouble du sommeil de l'adolescent`,
      `Trouble de la sociabilité acquise`,
    ],
    answer: 1,
    exp: `Le TSA est un trouble du neurodéveloppement caractérisé par des particularités de la communication sociale et des comportements ou intérêts restreints et répétitifs.`,
  },
  {
    cat: "tsa",
    q: `Pourquoi parle-t-on de « spectre » de l'autisme ?`,
    options: [
      `Parce qu'il est invisible`,
      `Parce que les manifestations varient fortement d'une personne à l'autre`,
      `Parce qu'il concerne la vue`,
      `Parce qu'il évolue uniquement par crises`,
    ],
    answer: 1,
    exp: `Le DSM-5 a regroupé les anciens sous-types (autisme, Asperger, TED) en un continuum unique : l'expression et l'intensité des particularités sont très variables.`,
  },
  {
    cat: "tsa",
    q: `Quels sont les deux grands domaines des critères diagnostiques du TSA ?`,
    options: [
      `Mémoire et attention`,
      `Communication / interactions sociales, et comportements restreints / répétitifs`,
      `Lecture et calcul`,
      `Sommeil et appétit`,
    ],
    answer: 1,
    exp: `Domaine A : déficits persistants de la communication sociale. Domaine B : caractère restreint et répétitif des comportements, intérêts ou activités, incluant les particularités sensorielles.`,
  },
  {
    cat: "tsa",
    q: `Les particularités sensorielles (hyper- ou hypo-réactivité) dans le TSA…`,
    options: [
      `n'existent pas`,
      `font partie des critères diagnostiques`,
      `concernent uniquement l'ouïe`,
      `apparaissent seulement à l'âge adulte`,
    ],
    answer: 1,
    exp: `Depuis le DSM-5, les réactions inhabituelles aux stimuli sensoriels (sons, textures, lumières…) sont intégrées aux critères du domaine B.`,
  },
  {
    cat: "tsa",
    q: `Le « camouflage » (ou masking) social désigne…`,
    options: [
      `un traitement médicamenteux`,
      `des stratégies pour masquer ses difficultés sociales`,
      `un type de thérapie de groupe`,
      `un signe de guérison`,
    ],
    answer: 1,
    exp: `Beaucoup de personnes autistes, notamment des filles et des femmes, masquent leurs difficultés (imitation, scripts sociaux), au prix d'une fatigue importante et parfois d'un diagnostic tardif.`,
  },
  {
    cat: "tsa",
    q: `Le lien entre le vaccin ROR et l'autisme est…`,
    options: [
      `scientifiquement prouvé`,
      `un mythe issu d'une étude frauduleuse rétractée`,
      `démontré par l'OMS`,
      `en cours de confirmation`,
    ],
    answer: 1,
    exp: `L'étude de Wakefield (1998) a été rétractée pour fraude. De très nombreuses études ont depuis écarté tout lien entre vaccination et autisme.`,
  },
  {
    cat: "tsa",
    q: `À quel âge les premiers signes du TSA peuvent-ils généralement être repérés ?`,
    options: [
      `Vers 12-15 ans`,
      `Dès les premières années de vie`,
      `Seulement à l'âge adulte`,
      `Jamais avant 10 ans`,
    ],
    answer: 1,
    exp: `Des signes (contact visuel, attention conjointe, pointage, langage) peuvent alerter dès la première ou deuxième année. Un repérage précoce permet une intervention précoce.`,
  },
  {
    cat: "tsa",
    q: `Le DSM-5 décrit le TSA selon des niveaux de sévérité fondés sur…`,
    options: [
      `l'âge du diagnostic`,
      `le besoin de soutien (niveaux 1 à 3)`,
      `le QI uniquement`,
      `le nombre de séances de rééducation`,
    ],
    answer: 1,
    exp: `Trois niveaux décrivent l'intensité du soutien nécessaire : 1 (« nécessite un soutien »), 2 (« soutien important »), 3 (« soutien très important »).`,
  },
  {
    cat: "tsa",
    q: `L'« attention conjointe », souvent atypique dans le TSA, désigne…`,
    options: [
      `la capacité à partager un focus d'attention avec autrui`,
      `la capacité à rester assis`,
      `la mémoire des visages`,
      `l'attention soutenue devant un écran`,
    ],
    answer: 0,
    exp: `Partager un objet d'attention (regarder ensemble, suivre un pointage, pointer pour montrer) est une étape sociale précoce, souvent atypique chez l'enfant autiste.`,
  },
  {
    cat: "tsa",
    q: `Les estimations actuelles de prévalence du TSA tournent autour de :`,
    options: [
      `1 personne sur 10 000`,
      `environ 1 % de la population`,
      `30 % de la population`,
      `1 personne sur 5`,
    ],
    answer: 1,
    exp: `Les estimations varient selon les critères et le repérage, mais convergent autour de ~1 % (certaines études récentes rapportent davantage, en lien avec un meilleur diagnostic).`,
  },
  {
    cat: "tsa",
    q: `Quelle approche est aujourd'hui privilégiée pour accompagner une personne autiste ?`,
    options: [
      `La recherche d'une « guérison »`,
      `Un accompagnement adapté et personnalisé`,
      `L'isolement social`,
      `L'absence d'intervention`,
    ],
    answer: 1,
    exp: `On ne « guérit » pas l'autisme. L'objectif est de soutenir le développement, l'autonomie et le bien-être, en s'appuyant sur les forces de la personne et en adaptant l'environnement.`,
  },

  /* ====================  TDAH  ==================== */
  {
    cat: "tdah",
    q: `Que signifie « TDAH » ?`,
    options: [
      `Trouble du développement et de l'apprentissage humain`,
      `Trouble déficit de l'attention avec ou sans hyperactivité`,
      `Trouble de l'audition`,
      `Trouble digestif aigu héréditaire`,
    ],
    answer: 1,
    exp: `Le TDAH associe, à des degrés divers, inattention, hyperactivité et impulsivité, avec un retentissement sur la vie quotidienne.`,
  },
  {
    cat: "tdah",
    q: `Combien de présentations cliniques du TDAH le DSM-5 distingue-t-il ?`,
    options: [
      `Une seule`,
      `Trois (inattentive, hyperactive/impulsive, mixte)`,
      `Sept`,
      `Aucune, c'est un trouble homogène`,
    ],
    answer: 1,
    exp: `Présentation à prédominance inattentive, à prédominance hyperactive-impulsive, ou combinée. La forme inattentive « pure » est souvent sous-repérée.`,
  },
  {
    cat: "tdah",
    q: `Pour parler de TDAH, les symptômes doivent être présents…`,
    options: [
      `uniquement à la maison`,
      `dans au moins deux contextes de vie (ex. école et maison)`,
      `seulement pendant les vacances`,
      `uniquement devant les écrans`,
    ],
    answer: 1,
    exp: `Le caractère envahissant (≥ 2 environnements) et le retentissement fonctionnel sont essentiels : c'est ce qui distingue un trouble d'une simple agitation situationnelle.`,
  },
  {
    cat: "tdah",
    q: `Avant quel âge les symptômes du TDAH doivent-ils être apparus (DSM-5) ?`,
    options: [`Avant 12 ans`, `Avant 3 ans`, `Avant 18 ans`, `Aucune limite d'âge`],
    answer: 0,
    exp: `Le DSM-5 exige la présence de plusieurs symptômes avant l'âge de 12 ans, même si le diagnostic est parfois posé bien plus tard.`,
  },
  {
    cat: "tdah",
    q: `Quels neurotransmetteurs sont principalement impliqués dans le TDAH ?`,
    options: [
      `Sérotonine et histamine`,
      `Dopamine et noradrénaline`,
      `Insuline et glucagon`,
      `Mélatonine seule`,
    ],
    answer: 1,
    exp: `Les circuits dopaminergiques et noradrénergiques, impliqués dans la motivation, la récompense et le contrôle attentionnel, sont au cœur des modèles du TDAH.`,
  },
  {
    cat: "tdah",
    q: `Le méthylphénidate (Ritaline®, Concerta®…) agit principalement en…`,
    options: [
      `bloquant la recapture de la dopamine`,
      `augmentant la sérotonine`,
      `détruisant des neurones`,
      `bloquant la douleur`,
    ],
    answer: 0,
    exp: `C'est un psychostimulant qui inhibe le transporteur de la dopamine (et de la noradrénaline) : la dopamine reste plus longtemps disponible dans la synapse, ce qui améliore l'attention.`,
  },
  {
    cat: "tdah",
    q: `Bien que stimulant, le méthylphénidate a souvent pour effet, chez la personne TDAH, de…`,
    options: [
      `aggraver l'agitation systématiquement`,
      `améliorer l'attention et réduire l'agitation`,
      `provoquer un sommeil immédiat`,
      `supprimer la mémoire`,
    ],
    answer: 1,
    exp: `Cet effet « paradoxal » s'explique par le renforcement des circuits de contrôle attentionnel : mieux régulé, le cerveau filtre davantage les distractions.`,
  },
  {
    cat: "tdah",
    q: `Le « réseau du mode par défaut » (Default Mode Network) est un réseau cérébral actif…`,
    options: [
      `pendant le sommeil profond uniquement`,
      `au repos, lors de la divagation mentale`,
      `seulement lors d'un effort physique`,
      `jamais chez l'enfant`,
    ],
    answer: 1,
    exp: `Dans le TDAH, ce réseau se désactiverait mal lors des tâches dirigées, ce qui favoriserait les intrusions de pensées et les pertes d'attention.`,
  },
  {
    cat: "tdah",
    q: `Les fonctions exécutives, souvent fragiles dans le TDAH, incluent…`,
    options: [
      `la digestion`,
      `l'inhibition, la mémoire de travail et la planification`,
      `la vision des couleurs`,
      `le rythme cardiaque`,
    ],
    answer: 1,
    exp: `Ces fonctions de « chef d'orchestre » du cerveau permettent de s'organiser, de résister aux distractions et de tenir un objectif dans le temps.`,
  },
  {
    cat: "tdah",
    q: `Le TDAH est-il causé par un « manque de volonté » ou une « mauvaise éducation » ?`,
    options: [
      `Oui, totalement`,
      `Non, il a une base neurobiologique`,
      `Oui, à cause des écrans uniquement`,
      `Oui, c'est un caprice`,
    ],
    answer: 1,
    exp: `Le TDAH n'est ni un défaut de caractère ni une faute éducative : c'est un trouble du neurodéveloppement, avec une forte composante génétique et des particularités cérébrales.`,
  },
  {
    cat: "tdah",
    q: `Quelle est une comorbidité fréquente du TDAH chez l'enfant ?`,
    options: [
      `La presbytie`,
      `Les troubles spécifiques des apprentissages (« dys »)`,
      `Le diabète de type 1`,
      `La myopie sévère`,
    ],
    answer: 1,
    exp: `Troubles « dys », anxiété, trouble oppositionnel, troubles du sommeil… accompagnent souvent le TDAH et nécessitent un repérage global.`,
  },
  {
    cat: "tdah",
    q: `La prise en charge du TDAH est avant tout…`,
    options: [
      `exclusivement médicamenteuse`,
      `multimodale (aménagements, psychoéducation, parfois médicament)`,
      `uniquement chirurgicale`,
      `inutile`,
    ],
    answer: 1,
    exp: `On combine aménagements scolaires, guidance parentale, psychoéducation et remédiation. Le médicament n'est qu'un outil parmi d'autres, jamais isolé.`,
  },

  /* ====================  TROUBLES « DYS »  ==================== */
  {
    cat: "dys",
    q: `La dyslexie est un trouble spécifique…`,
    options: [`de l'attention`, `de la lecture`, `de la coordination`, `du sommeil`],
    answer: 1,
    exp: `La dyslexie touche l'apprentissage de la lecture (décodage, identification des mots, fluence), malgré un enseignement adapté et une intelligence normale.`,
  },
  {
    cat: "dys",
    q: `Un déficit fréquemment central dans la dyslexie concerne…`,
    options: [
      `la conscience phonologique`,
      `la mémoire des visages`,
      `la motricité fine uniquement`,
      `l'audition périphérique`,
    ],
    answer: 0,
    exp: `Beaucoup d'enfants dyslexiques ont des difficultés à manipuler les sons de la langue (phonèmes), ce qui gêne la correspondance entre lettres et sons.`,
  },
  {
    cat: "dys",
    q: `La dyscalculie est un trouble spécifique…`,
    options: [
      `de l'écriture`,
      `des compétences numériques et du calcul`,
      `du langage oral`,
      `de la lecture`,
    ],
    answer: 1,
    exp: `La dyscalculie affecte le sens du nombre, le dénombrement, les faits arithmétiques et le calcul, indépendamment de l'intelligence générale.`,
  },
  {
    cat: "dys",
    q: `La dysorthographie désigne un trouble…`,
    options: [`de l'orthographe`, `de la vision`, `de la marche`, `de la mémoire à long terme`],
    answer: 0,
    exp: `La dysorthographie (trouble de l'expression écrite) est souvent associée à la dyslexie : la transcription des sons en lettres est durablement difficile.`,
  },
  {
    cat: "dys",
    q: `Pour qu'un trouble « dys » soit diagnostiqué, les difficultés ne doivent PAS s'expliquer par…`,
    options: [
      `une déficience intellectuelle, un déficit sensoriel ou un manque d'enseignement`,
      `la présence de frères et sœurs`,
      `la couleur des yeux`,
      `le lieu d'habitation`,
    ],
    answer: 0,
    exp: `Le caractère « spécifique » suppose d'écarter d'autres causes : le trouble persiste malgré une intelligence normale, des sens fonctionnels et un enseignement adéquat.`,
  },
  {
    cat: "dys",
    q: `Quel professionnel rééduque principalement la dyslexie et la dysorthographie ?`,
    options: [`Le kinésithérapeute`, `L'orthophoniste`, `L'ophtalmologue`, `Le cardiologue`],
    answer: 1,
    exp: `L'orthophoniste évalue et rééduque le langage écrit et oral. La prise en charge est d'autant plus efficace qu'elle est précoce.`,
  },
  {
    cat: "dys",
    q: `Lequel de ces aménagements est typique pour un élève « dys » lors des examens ?`,
    options: [
      `Le tiers-temps supplémentaire`,
      `L'interdiction d'écrire`,
      `La suppression des évaluations`,
      `Le redoublement automatique`,
    ],
    answer: 0,
    exp: `Le « tiers-temps » (temps majoré), l'usage d'un ordinateur, des consignes adaptées ou un secrétaire font partie des aménagements possibles (via PAP ou PPS).`,
  },
  {
    cat: "dys",
    q: `Les troubles « dys »…`,
    options: [
      `disparaissent spontanément à l'adolescence`,
      `sont durables mais peuvent être compensés`,
      `sont contagieux`,
      `concernent seulement les adultes`,
    ],
    answer: 1,
    exp: `Ce sont des troubles persistants d'origine neurodéveloppementale ; la rééducation et les compensations (outils, stratégies) réduisent le retentissement.`,
  },
  {
    cat: "dys",
    q: `Le niveau intellectuel d'un enfant « dys » est typiquement…`,
    options: [
      `inférieur à la moyenne par définition`,
      `dans la norme (le trouble est « spécifique »)`,
      `toujours supérieur à 130`,
      `impossible à évaluer`,
    ],
    answer: 1,
    exp: `Par définition, un trouble spécifique des apprentissages contraste avec une efficience intellectuelle normale : c'est une dissociation, non un retard global.`,
  },
  {
    cat: "dys",
    q: `Parmi les troubles « dys », lequel est le plus fréquent ?`,
    options: [`La dyscalculie`, `La dyslexie`, `La dysphasie`, `La dyspraxie`],
    answer: 1,
    exp: `La dyslexie est le trouble spécifique des apprentissages le plus répandu (estimations autour de 5 à 10 % des enfants selon les critères).`,
  },
  {
    cat: "dys",
    q: `En France, quel dispositif aménage la scolarité d'un élève « dys » sans passer par la MDPH ?`,
    options: [
      `Le PAP (plan d'accompagnement personnalisé)`,
      `Le permis de conduire`,
      `Le plan épargne logement`,
      `Le baccalauréat`,
    ],
    answer: 0,
    exp: `Le PAP est mis en place au sein de l'établissement sur avis du médecin scolaire, sans reconnaissance de handicap par la MDPH (contrairement au PPS).`,
  },

  /* ====================  COORDINATION, LANGAGE & COMMUNICATION  ==================== */
  {
    cat: "moteur",
    q: `Le sigle « TDC » désigne le trouble…`,
    options: [
      `du comportement alimentaire`,
      `développemental de la coordination`,
      `de la communication écrite`,
      `du contrôle de la colère`,
    ],
    answer: 1,
    exp: `Le TDC (anciennement « dyspraxie ») est un trouble de l'acquisition de la coordination motrice : gestes maladroits, difficultés à planifier et exécuter des mouvements.`,
  },
  {
    cat: "moteur",
    q: `Quel terme ancien correspond le plus souvent au TDC ?`,
    options: [`La dyslexie`, `La dyspraxie`, `La dysphasie`, `La dyscalculie`],
    answer: 1,
    exp: `« Dyspraxie » est l'ancienne appellation ; on parle aujourd'hui plutôt de trouble développemental de la coordination dans les classifications.`,
  },
  {
    cat: "moteur",
    q: `Le TDC retentit fréquemment sur…`,
    options: [
      `la digestion`,
      `l'écriture et les gestes du quotidien`,
      `la vision des couleurs`,
      `l'audition`,
    ],
    answer: 1,
    exp: `Boutonner, lacer, écrire, manier des outils, faire du sport… autant d'activités gênées. L'écriture (graphisme) est souvent particulièrement coûteuse.`,
  },
  {
    cat: "moteur",
    q: `Quels professionnels rééduquent typiquement le TDC ?`,
    options: [
      `Le psychomotricien et l'ergothérapeute`,
      `Le dermatologue`,
      `Le radiologue`,
      `Le pharmacien`,
    ],
    answer: 0,
    exp: `La psychomotricité et l'ergothérapie travaillent la coordination, le geste et les adaptations (outils, ordinateur) pour favoriser l'autonomie.`,
  },
  {
    cat: "moteur",
    q: `Le « TDL » (anciennement dysphasie) est un trouble…`,
    options: [
      `de la coordination`,
      `développemental du langage (oral)`,
      `de la lecture`,
      `du calcul`,
    ],
    answer: 1,
    exp: `Le trouble développemental du langage est un trouble primaire, durable et sévère du langage oral, non expliqué par une autre cause (surdité, TSA, déficience…).`,
  },
  {
    cat: "moteur",
    q: `Quelle est la différence-clé entre un simple retard de langage et un TDL ?`,
    options: [
      `La couleur des cheveux`,
      `Le caractère durable et sévère du trouble`,
      `Le nombre de frères et sœurs`,
      `L'heure du coucher`,
    ],
    answer: 1,
    exp: `Un retard simple se résorbe ; le TDL persiste et affecte durablement la structure du langage (vocabulaire, syntaxe, compréhension) malgré la stimulation.`,
  },
  {
    cat: "moteur",
    q: `Le bégaiement est classé dans le DSM-5 parmi les troubles…`,
    options: [`moteurs purs`, `de la communication`, `alimentaires`, `du sommeil`],
    answer: 1,
    exp: `Le bégaiement (trouble de la fluidité de l'élocution apparaissant dans l'enfance) fait partie des troubles de la communication, aux côtés du TDL et du trouble des sons de la parole.`,
  },
  {
    cat: "moteur",
    q: `Quel professionnel prend en charge le langage oral et le bégaiement ?`,
    options: [`L'orthophoniste`, `Le podologue`, `L'anesthésiste`, `Le chirurgien`],
    answer: 0,
    exp: `L'orthophoniste évalue et rééduque le langage oral, la parole, la fluence et la communication.`,
  },
  {
    cat: "moteur",
    q: `Le syndrome de Gilles de la Tourette se caractérise par…`,
    options: [
      `uniquement des tics moteurs`,
      `des tics moteurs ET vocaux évoluant depuis plus d'un an`,
      `une perte de la vue`,
      `une paralysie`,
    ],
    answer: 1,
    exp: `Le diagnostic exige des tics moteurs multiples et au moins un tic vocal, durant plus d'un an, avec un début avant 18 ans.`,
  },
  {
    cat: "moteur",
    q: `La coprolalie (émission involontaire de mots grossiers) dans le syndrome de Tourette est…`,
    options: [`systématique`, `en réalité rare`, `obligatoire au diagnostic`, `sans rapport`],
    answer: 1,
    exp: `Contrairement à une idée répandue (et au cinéma), la coprolalie ne concerne qu'une minorité de personnes Tourette et n'est pas nécessaire au diagnostic.`,
  },
  {
    cat: "moteur",
    q: `Les tics sont typiquement…`,
    options: [
      `parfaitement contrôlables en permanence`,
      `réfrénables un bref instant, mais avec une « tension » qui revient`,
      `douloureux et permanents`,
      `un signe de mensonge`,
    ],
    answer: 1,
    exp: `Les tics peuvent être brièvement réfrénés au prix d'un inconfort croissant ; le stress et la fatigue les majorent souvent, le relâchement aussi.`,
  },

  /* ====================  NEUROBIOLOGIE & PRISE EN CHARGE  ==================== */
  {
    cat: "neuro",
    q: `En France, quelle autorité publie les recommandations de bonnes pratiques sur les TND ?`,
    options: [
      `La HAS (Haute Autorité de Santé)`,
      `La SNCF`,
      `L'INSEE`,
      `La CNIL`,
    ],
    answer: 0,
    exp: `La HAS élabore des recommandations (repérage, diagnostic, interventions) qui font référence pour les professionnels de santé et de l'éducation.`,
  },
  {
    cat: "neuro",
    q: `Que signifie « MDPH » ?`,
    options: [
      `Maison départementale des personnes handicapées`,
      `Ministère de la pédagogie et de l'habitat`,
      `Mutuelle des praticiens hospitaliers`,
      `Maison des parents et des héritiers`,
    ],
    answer: 0,
    exp: `La MDPH instruit les demandes liées au handicap : reconnaissance, AEEH, orientation, attribution d'un AESH, PPS.`,
  },
  {
    cat: "neuro",
    q: `L'« AESH » est…`,
    options: [
      `un accompagnant d'élève en situation de handicap`,
      `un médicament`,
      `un examen médical`,
      `un logiciel scolaire`,
    ],
    answer: 0,
    exp: `L'AESH (ex-AVS) accompagne en classe les élèves en situation de handicap, sur notification de la MDPH, pour favoriser leur scolarisation.`,
  },
  {
    cat: "neuro",
    q: `Quelle est la différence entre un PPS et un PAP ?`,
    options: [
      `Aucune, ce sont des synonymes`,
      `Le PPS passe par la MDPH (handicap), le PAP non`,
      `Le PAP est réservé aux adultes`,
      `Le PPS concerne la cantine`,
    ],
    answer: 1,
    exp: `Le PPS (projet personnalisé de scolarisation) relève d'une reconnaissance de handicap par la MDPH ; le PAP (plan d'accompagnement personnalisé) est interne à l'établissement, sur avis médical.`,
  },
  {
    cat: "neuro",
    q: `Le neuropsychologue intervient surtout pour…`,
    options: [
      `réparer des appareils`,
      `évaluer les fonctions cognitives (attention, mémoire, fonctions exécutives)`,
      `prescrire des lunettes`,
      `poser des plâtres`,
    ],
    answer: 1,
    exp: `Le bilan neuropsychologique objective le profil cognitif (forces et fragilités) et aide au diagnostic ainsi qu'au choix des aménagements.`,
  },
  {
    cat: "neuro",
    q: `Sur le plan réglementaire en France, le méthylphénidate est un médicament…`,
    options: [
      `en vente libre`,
      `classé comme stupéfiant, sur ordonnance sécurisée`,
      `distribué sans ordonnance`,
      `totalement interdit`,
    ],
    answer: 1,
    exp: `En raison de sa nature de psychostimulant, sa prescription est encadrée : ordonnance sécurisée, règles de primo-prescription et de suivi spécifiques.`,
  },
  {
    cat: "neuro",
    q: `La « neuroplasticité » désigne…`,
    options: [
      `la capacité du cerveau à se réorganiser`,
      `une matière plastique présente dans le cerveau`,
      `une maladie dégénérative`,
      `une technique d'imagerie`,
    ],
    answer: 0,
    exp: `La plasticité cérébrale — capacité des réseaux neuronaux à se modifier avec l'expérience et la rééducation — fonde l'intérêt des interventions précoces.`,
  },
  {
    cat: "neuro",
    q: `Quel professionnel travaille la motricité fine et propose des adaptations matérielles (ex. ordinateur pour écrire) ?`,
    options: [`L'ergothérapeute`, `Le dentiste`, `Le notaire`, `Le vétérinaire`],
    answer: 0,
    exp: `L'ergothérapeute travaille l'autonomie dans les activités quotidiennes et scolaires, et préconise des outils de compensation adaptés.`,
  },
  {
    cat: "neuro",
    q: `Un QI ≥ 130 correspond environ au seuil…`,
    options: [
      `de la déficience intellectuelle`,
      `du haut potentiel intellectuel (≈ 2 % de la population)`,
      `de la moyenne`,
      `de l'autisme`,
    ],
    answer: 1,
    exp: `130 correspond à +2 écarts-types au-dessus de la moyenne (100), soit environ 2,3 % de la population. Le HPI n'est pas un trouble.`,
  },
  {
    cat: "neuro",
    q: `Un trouble du développement intellectuel associe un déficit cognitif et…`,
    options: [
      `une grande taille`,
      `des limitations du fonctionnement adaptatif`,
      `une excellente coordination`,
      `une vision parfaite`,
    ],
    answer: 1,
    exp: `Le diagnostic ne repose pas que sur le QI : il intègre les capacités adaptatives (autonomie, communication, vie sociale et quotidienne).`,
  },
  {
    cat: "neuro",
    q: `Pourquoi l'intervention précoce est-elle recommandée dans les TND ?`,
    options: [
      `Pour réduire les coûts uniquement`,
      `Parce que la plasticité cérébrale est maximale tôt`,
      `Parce que c'est obligatoire après 18 ans`,
      `Cela n'a aucun intérêt`,
    ],
    answer: 1,
    exp: `Plus l'accompagnement est précoce, plus il tire parti de la plasticité du cerveau en développement et limite le sur-handicap (estime de soi, apprentissages).`,
  },
  {
    cat: "neuro",
    q: `Face aux TND à l'école, l'approche la plus pertinente est…`,
    options: [
      `d'ignorer les particularités`,
      `d'adapter l'environnement et les supports aux besoins de l'élève`,
      `d'exclure l'élève`,
      `d'attendre la fin de l'adolescence`,
    ],
    answer: 1,
    exp: `Penser un environnement « capacitant » (consignes claires, supports adaptés, étayage des fonctions exécutives) profite à l'élève concerné — et souvent à toute la classe.`,
  },
];

/* ------------------------------------------------------------------ */
/*  DOMAINES — palette « spectre » (une teinte par domaine)            */
/* ------------------------------------------------------------------ */

const CATEGORIES = {
  gen: { label: `Généralités & classification`, short: `Généralités`, color: "#FCC419" },
  tsa: { label: `Spectre de l'autisme`, short: `TSA`, color: "#F06595" },
  tdah: { label: `TDAH`, short: `TDAH`, color: "#FF922B" },
  dys: { label: `Troubles « Dys »`, short: `Dys`, color: "#4DABF7" },
  moteur: { label: `Coordination, langage & communication`, short: `Coordination & langage`, color: "#20C997" },
  neuro: { label: `Neurobiologie & prise en charge`, short: `Neuro & soins`, color: "#9775FA" },
};
const CAT_ORDER = ["gen", "tsa", "tdah", "dys", "moteur", "neuro"];

/* ------------------------------------------------------------------ */
/*  UTILITAIRES                                                         */
/* ------------------------------------------------------------------ */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(category, limit) {
  let pool = category === "all" ? QUESTIONS : QUESTIONS.filter((q) => q.cat === category);
  pool = shuffle(pool);
  if (limit && limit < pool.length) pool = pool.slice(0, limit);
  return pool.map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return {
      ...q,
      options: order.map((i) => q.options[i]),
      answer: order.indexOf(q.answer),
    };
  });
}

const LETTERS = ["A", "B", "C", "D"];

/* ------------------------------------------------------------------ */
/*  ICÔNES                                                             */
/* ------------------------------------------------------------------ */

const Icon = {
  Check: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  Cross: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Brain: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5a3 3 0 0 0-5.5-1.6A2.7 2.7 0 0 0 4 6.5 2.8 2.8 0 0 0 3 12a2.8 2.8 0 0 0 1 5 2.7 2.7 0 0 0 2.5 2.6A3 3 0 0 0 12 19zM12 5a3 3 0 0 1 5.5-1.6A2.7 2.7 0 0 1 20 6.5 2.8 2.8 0 0 1 21 12a2.8 2.8 0 0 1-1 5 2.7 2.7 0 0 1-2.5 2.6A3 3 0 0 1 12 19z" />
    </svg>
  ),
  Refresh: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  ),
  Grid: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  List: (p) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
};

/* L'emblème : un symbole infini parcouru par le spectre des domaines */
function Emblem({ size = 64 }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 100 50" className="qz-emblem" aria-hidden="true">
      <defs>
        <linearGradient id="qz-spectrum" x1="0" y1="0" x2="1" y2="0">
          {CAT_ORDER.map((c, i) => (
            <stop key={c} offset={`${(i / (CAT_ORDER.length - 1)) * 100}%`} stopColor={CATEGORIES[c].color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d="M50,25 C50,7 22,7 22,25 C22,43 50,43 50,25 C50,7 78,7 78,25 C78,43 50,43 50,25 Z"
        fill="none"
        stroke="url(#qz-spectrum)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  STYLES                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
.qz-root{
  --bg:#0D1017; --surface:#161B26; --surface-2:#1E2533; --surface-3:#283143;
  --line:#2C3547; --line-soft:#222A39;
  --text:#ECEEF4; --text-2:#AEB6C6; --text-3:#79839A;
  --ok:#37C26B; --ok-soft:rgba(55,194,107,.13);
  --err:#F0686D; --err-soft:rgba(240,104,109,.13);
  --focus:#79B8FF;
  --r:18px;
  --spectrum:linear-gradient(90deg,#FCC419,#F06595,#FF922B,#4DABF7,#20C997,#9775FA);
  position:relative; min-height:100vh; width:100%;
  background:var(--bg); color:var(--text);
  font-family:'Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.qz-root *{box-sizing:border-box}
.qz-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(45vw 45vw at 12% 8%, rgba(151,117,250,.16), transparent 60%),
    radial-gradient(40vw 40vw at 88% 14%, rgba(240,101,149,.13), transparent 60%),
    radial-gradient(50vw 50vw at 78% 96%, rgba(77,171,247,.12), transparent 62%),
    radial-gradient(40vw 40vw at 8% 92%, rgba(32,201,151,.10), transparent 60%);
}
.qz-wrap{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:30px 22px 64px}

/* wordmark */
.qz-mark{display:flex;align-items:center;gap:10px;margin-bottom:26px}
.qz-mark .qz-emblem{filter:drop-shadow(0 0 10px rgba(151,117,250,.25))}
.qz-mark-txt{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;letter-spacing:.16em;
  text-transform:uppercase;font-size:12px;color:var(--text-2)}

/* hero */
.qz-eyebrow{font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--text-3);margin-bottom:18px}
.qz-hero-emblem{margin:0 auto 22px;display:flex;justify-content:center}
.qz-hero-emblem .qz-emblem{filter:drop-shadow(0 0 22px rgba(151,117,250,.35))}
.qz-h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;line-height:1.04;
  font-size:clamp(30px,7vw,50px);letter-spacing:-.02em;margin:0 0 16px;text-wrap:balance}
.qz-h1 .qz-accent{background:var(--spectrum);-webkit-background-clip:text;background-clip:text;color:transparent}
.qz-lead{font-size:16.5px;line-height:1.6;color:var(--text-2);max-width:58ch;margin:0 auto 0}
.qz-center{text-align:center}

.qz-section-label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-3);margin:40px 0 14px;display:flex;align-items:center;gap:10px}
.qz-section-label::after{content:"";flex:1;height:1px;background:var(--line-soft)}

/* category picker */
.qz-cats{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}
.qz-cat{display:flex;align-items:center;gap:12px;padding:15px 16px;border-radius:14px;
  background:var(--surface);border:1px solid var(--line);color:var(--text);cursor:pointer;
  text-align:left;font:inherit;transition:transform .15s,border-color .15s,background .15s;width:100%}
.qz-cat:hover{transform:translateY(-2px);background:var(--surface-2)}
.qz-cat-dot{width:13px;height:13px;border-radius:50%;flex:none;background:var(--cat);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--cat) 18%,transparent)}
.qz-cat-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.qz-cat-name{font-weight:700;font-size:14.5px;line-height:1.2}
.qz-cat-count{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3)}
.qz-cat[aria-pressed="true"]{border-color:var(--cat);background:color-mix(in srgb,var(--cat) 10%,var(--surface));
  box-shadow:0 0 0 1px var(--cat),0 8px 26px -14px var(--cat)}

/* length toggle (segmented) */
.qz-seg{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:4px;gap:4px}
.qz-seg button{font:inherit;font-weight:700;font-size:13.5px;color:var(--text-2);background:transparent;
  border:0;border-radius:9px;padding:9px 18px;cursor:pointer;transition:background .15s,color .15s}
.qz-seg button[aria-pressed="true"]{background:var(--surface-3);color:var(--text)}

/* primary CTA */
.qz-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-top:30px;
  font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:17px;
  padding:16px 30px;border-radius:99px;border:0;cursor:pointer;width:100%;
  color:#11151D;background:linear-gradient(135deg,#F6F8FD,#DCE2EE);
  box-shadow:0 14px 40px -16px rgba(151,117,250,.5),0 2px 0 rgba(255,255,255,.4) inset;
  transition:transform .15s,box-shadow .2s}
.qz-cta:hover{transform:translateY(-2px);box-shadow:0 20px 46px -16px rgba(151,117,250,.7)}
.qz-cta .qz-arrow{font-size:1.15em}

/* ---------- QUIZ ---------- */
.qz-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}
.qz-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:99px;
  background:color-mix(in srgb,var(--cat) 14%,var(--surface));border:1px solid color-mix(in srgb,var(--cat) 45%,transparent);
  font-weight:700;font-size:13px;color:var(--text)}
.qz-badge .qz-cat-dot{width:9px;height:9px;box-shadow:none}
.qz-meta{display:flex;align-items:center;gap:14px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-2)}
.qz-meta b{color:var(--text)}
.qz-streak{display:inline-flex;align-items:center;gap:6px;color:var(--text);font-weight:700;
  padding:5px 11px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line);font-size:12px}
.qz-streak svg{color:#FF922B}

/* progress = the spectrum meter (signature) */
.qz-prog{position:relative;height:8px;border-radius:99px;overflow:hidden;background:var(--spectrum);margin-bottom:26px}
.qz-prog::after{content:"";position:absolute;top:0;right:0;bottom:0;left:var(--pct,0%);
  background:var(--surface-2);transition:left .45s cubic-bezier(.2,.8,.2,1)}
.qz-counter{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-3);margin-bottom:8px}

.qz-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:26px 24px}
.qz-q{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:clamp(20px,4.4vw,25px);
  line-height:1.3;letter-spacing:-.01em;margin:0 0 22px;text-wrap:pretty}

.qz-opts{display:flex;flex-direction:column;gap:11px}
.qz-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font:inherit;font-size:16px;
  line-height:1.4;color:var(--text);background:var(--surface-2);border:1.5px solid var(--line);
  border-radius:13px;padding:15px 16px;cursor:pointer;transition:transform .12s,border-color .15s,background .15s}
.qz-opt:hover:not(:disabled){transform:translateY(-1px);background:var(--surface-3);border-color:#3A455A}
.qz-opt:disabled{cursor:default}
.qz-letter{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;
  font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px;
  background:var(--surface-3);color:var(--text-2);transition:background .15s,color .15s}
.qz-opt-txt{flex:1}
.qz-opt-ico{flex:none;font-size:18px;display:none}
.qz-opt.is-correct{border-color:var(--ok);background:var(--ok-soft)}
.qz-opt.is-correct .qz-letter{background:var(--ok);color:#06210f}
.qz-opt.is-correct .qz-opt-ico{display:block;color:var(--ok)}
.qz-opt.is-wrong{border-color:var(--err);background:var(--err-soft)}
.qz-opt.is-wrong .qz-letter{background:var(--err);color:#2a0809}
.qz-opt.is-wrong .qz-opt-ico{display:block;color:var(--err)}
.qz-opt.is-muted{opacity:.5}

/* feedback + explanation */
.qz-feedback{margin-top:20px;animation:qz-rise .35s ease both}
.qz-verdict{display:inline-flex;align-items:center;gap:9px;font-family:'Bricolage Grotesque',sans-serif;
  font-weight:700;font-size:16px;margin-bottom:12px}
.qz-verdict.ok{color:var(--ok)} .qz-verdict.err{color:var(--err)}
.qz-verdict svg{font-size:20px}
.qz-exp{display:flex;gap:13px;background:var(--surface-2);border:1px solid var(--line);
  border-left:3px solid var(--cat);border-radius:12px;padding:16px 17px}
.qz-exp-ico{flex:none;color:var(--cat);font-size:20px;margin-top:1px}
.qz-exp-body{font-size:15px;line-height:1.62;color:var(--text-2)}
.qz-exp-body b{color:var(--text);font-weight:700}

.qz-next{display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:22px;
  font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:16px;float:right;
  padding:13px 24px;border-radius:99px;border:0;cursor:pointer;color:#11151D;
  background:linear-gradient(135deg,#F6F8FD,#DCE2EE);box-shadow:0 10px 30px -14px rgba(0,0,0,.6);
  transition:transform .15s}
.qz-next:hover{transform:translateY(-2px)}
.qz-clear{clear:both}

/* ---------- RÉSULTATS ---------- */
.qz-res-emblem{display:flex;justify-content:center;margin-bottom:18px}
.qz-res-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(26px,6vw,38px);
  letter-spacing:-.02em;margin:0 0 8px;text-align:center}
.qz-score{text-align:center;margin:18px 0 6px}
.qz-score-big{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;line-height:1;
  font-size:clamp(56px,15vw,92px);background:var(--spectrum);-webkit-background-clip:text;background-clip:text;color:transparent}
.qz-score-sub{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--text-2);margin-top:6px}
.qz-tier{text-align:center;font-size:17px;line-height:1.5;color:var(--text);max-width:46ch;margin:14px auto 0}

.qz-breakdown{margin-top:34px;display:flex;flex-direction:column;gap:15px}
.qz-bd-row{display:flex;flex-direction:column;gap:7px}
.qz-bd-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px}
.qz-bd-name{display:flex;align-items:center;gap:9px;font-weight:700}
.qz-bd-score{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-2)}
.qz-bd-track{height:9px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.qz-bd-fill{height:100%;border-radius:99px;background:var(--cat);transition:width .8s cubic-bezier(.2,.8,.2,1)}

.qz-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:34px}
.qz-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;flex:1 1 auto;
  font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;padding:14px 18px;
  border-radius:99px;cursor:pointer;border:1px solid var(--line);background:var(--surface-2);color:var(--text);
  transition:transform .15s,background .15s,border-color .15s}
.qz-btn:hover{transform:translateY(-2px);background:var(--surface-3)}
.qz-btn.primary{border:0;color:#11151D;background:linear-gradient(135deg,#F6F8FD,#DCE2EE)}
.qz-btn[aria-pressed="true"]{border-color:var(--focus);color:var(--text)}

/* review */
.qz-review{margin-top:30px;display:flex;flex-direction:column;gap:13px}
.qz-rev-empty{text-align:center;color:var(--text-2);background:var(--surface);border:1px solid var(--line);
  border-radius:14px;padding:26px;font-size:15.5px;line-height:1.5}
.qz-rev-item{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--cat);
  border-radius:13px;padding:17px 18px}
.qz-rev-cat{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--cat);margin-bottom:8px}
.qz-rev-q{font-weight:700;font-size:15.5px;line-height:1.4;margin-bottom:12px}
.qz-rev-line{display:flex;gap:9px;align-items:flex-start;font-size:14px;line-height:1.45;margin-bottom:6px}
.qz-rev-line svg{flex:none;font-size:16px;margin-top:1px}
.qz-rev-line.ko{color:var(--text-2)} .qz-rev-line.ko svg{color:var(--err)}
.qz-rev-line.ok svg{color:var(--ok)} .qz-rev-line.ok b{color:var(--text)}
.qz-rev-exp{margin-top:10px;font-size:13.5px;line-height:1.55;color:var(--text-3);padding-top:10px;border-top:1px solid var(--line-soft)}

/* accessibility */
.qz-root button:focus-visible,.qz-cat:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
@keyframes qz-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.qz-fade{animation:qz-rise .4s ease both}
.qz-kbd-hint{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3);text-align:center;margin-top:18px}

@media (max-width:560px){
  .qz-wrap{padding:24px 16px 56px}
  .qz-cats{grid-template-columns:1fr}
  .qz-top{flex-wrap:wrap}
  .qz-card{padding:22px 18px}
  .qz-actions .qz-btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){
  .qz-root *,.qz-root *::before,.qz-root *::after{animation:none!important;transition:none!important}
}
`;

/* ------------------------------------------------------------------ */
/*  COMPOSANT PRINCIPAL                                                 */
/* ------------------------------------------------------------------ */

export default function QuizTND() {
  const [screen, setScreen] = useState("home"); // home | quiz | results
  const [category, setCategory] = useState("all");
  const [length, setLength] = useState(20); // 10 | 20 | 0 (=tout)
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [showReview, setShowReview] = useState(false);

  /* charge les polices */
  useEffect(() => {
    const id = "qz-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(l);
  }, []);

  const total = deck.length;
  const current = deck[index];
  const score = useMemo(() => records.filter((r) => r.correct).length, [records]);
  const pct = total ? (records.length / total) * 100 : 0;

  const catColor = (id) => CATEGORIES[id]?.color || "#9775FA";
  const counts = useMemo(() => {
    const c = {};
    CAT_ORDER.forEach((k) => (c[k] = QUESTIONS.filter((q) => q.cat === k).length));
    return c;
  }, []);
  const poolSize =
    category === "all" ? QUESTIONS.length : QUESTIONS.filter((q) => q.cat === category).length;
  const effLength = length === 0 ? poolSize : Math.min(length, poolSize);

  const start = useCallback(() => {
    setDeck(buildDeck(category, length === 0 ? null : length));
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setRecords([]);
    setStreak(0);
    setShowReview(false);
    setScreen("quiz");
  }, [category, length]);

  const answer = useCallback(
    (i) => {
      if (revealed || !current) return;
      const correct = i === current.answer;
      setSelected(i);
      setRevealed(true);
      setStreak((s) => (correct ? s + 1 : 0));
      setRecords((r) => [
        ...r,
        { cat: current.cat, q: current.q, options: current.options, answer: current.answer, exp: current.exp, selected: i, correct },
      ]);
    },
    [revealed, current]
  );

  const next = useCallback(() => {
    if (index < total - 1) {
      setIndex((n) => n + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      setScreen("results");
    }
  }, [index, total]);

  /* clavier : 1-4 pour répondre, Entrée/Espace pour avancer */
  useEffect(() => {
    if (screen !== "quiz") return;
    const onKey = (e) => {
      if (!revealed && ["1", "2", "3", "4"].includes(e.key)) {
        const i = Number(e.key) - 1;
        if (current && i < current.options.length) answer(i);
      } else if (revealed && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, revealed, current, answer, next]);

  /* stats par domaine pour l'écran de résultats */
  const breakdown = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      if (!map[r.cat]) map[r.cat] = { ok: 0, n: 0 };
      map[r.cat].n += 1;
      if (r.correct) map[r.cat].ok += 1;
    });
    return CAT_ORDER.filter((k) => map[k]).map((k) => ({ id: k, ...map[k] }));
  }, [records]);

  const errors = useMemo(() => records.filter((r) => !r.correct), [records]);
  const percentage = total ? Math.round((score / total) * 100) : 0;

  const tier = (p) => {
    if (p >= 90) return "Expertise remarquable des troubles du neurodéveloppement.";
    if (p >= 70) return "Très bonne maîtrise — quelques nuances à parfaire.";
    if (p >= 50) return "De bonnes bases, à consolider domaine par domaine.";
    return "À retravailler — et les explications sont justement là pour ça.";
  };

  return (
    <div className="qz-root" lang="fr">
      <style>{CSS}</style>
      <div className="qz-bg" />

      {/* ----------------------------- ACCUEIL ----------------------------- */}
      {screen === "home" && (
        <div className="qz-wrap qz-fade">
          <div className="qz-mark">
            <Emblem size={40} />
            <span className="qz-mark-txt">Neuro · Spectre</span>
          </div>

          <div className="qz-center">
            <div className="qz-eyebrow">Quiz interactif · 70 questions · 6 domaines</div>
            <div className="qz-hero-emblem">
              <Emblem size={92} />
            </div>
            <h1 className="qz-h1">
              Le grand quiz des <span className="qz-accent">troubles du neurodéveloppement</span>
            </h1>
            <p className="qz-lead">
              Testez et approfondissez vos connaissances sur les TND : autisme, TDAH, troubles « dys »,
              coordination, langage et prise en charge. Chaque réponse est expliquée.
            </p>
          </div>

          <div className="qz-section-label">Choisissez un domaine</div>
          <div className="qz-cats">
            <button
              className="qz-cat"
              style={{ "--cat": "#ECEEF4" }}
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              <span className="qz-cat-dot" style={{ background: "var(--text)" }} />
              <span className="qz-cat-body">
                <span className="qz-cat-name">Tout le programme</span>
                <span className="qz-cat-count">{QUESTIONS.length} questions</span>
              </span>
            </button>
            {CAT_ORDER.map((id) => (
              <button
                key={id}
                className="qz-cat"
                style={{ "--cat": catColor(id) }}
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
              >
                <span className="qz-cat-dot" />
                <span className="qz-cat-body">
                  <span className="qz-cat-name">{CATEGORIES[id].label}</span>
                  <span className="qz-cat-count">{counts[id]} questions</span>
                </span>
              </button>
            ))}
          </div>

          <div className="qz-section-label">Longueur de la partie</div>
          <div className="qz-seg" role="group" aria-label="Nombre de questions">
            <button aria-pressed={length === 10} onClick={() => setLength(10)}>10</button>
            <button aria-pressed={length === 20} onClick={() => setLength(20)}>20</button>
            <button aria-pressed={length === 0} onClick={() => setLength(0)}>
              Tout ({poolSize})
            </button>
          </div>

          <button className="qz-cta" onClick={start}>
            Commencer la partie · {effLength} questions
            <Icon.Arrow className="qz-arrow" />
          </button>
          <div className="qz-kbd-hint">Astuce : répondez avec les touches 1 à 4, validez avec Entrée.</div>
        </div>
      )}

      {/* ----------------------------- QUIZ ----------------------------- */}
      {screen === "quiz" && current && (
        <div className="qz-wrap">
          <div className="qz-top">
            <span className="qz-badge" style={{ "--cat": catColor(current.cat) }}>
              <span className="qz-cat-dot" style={{ background: catColor(current.cat) }} />
              {CATEGORIES[current.cat].short}
            </span>
            <span className="qz-meta">
              {streak >= 2 && (
                <span className="qz-streak">
                  <Icon.Check /> série de {streak}
                </span>
              )}
              <span>
                <b>{score}</b> bonnes
              </span>
            </span>
          </div>

          <div className="qz-counter">
            Question {index + 1} sur {total}
          </div>
          <div className="qz-prog" style={{ "--pct": `${pct}%` }} aria-hidden="true" />

          <div className="qz-card" style={{ "--cat": catColor(current.cat) }}>
            <h2 className="qz-q" key={index}>
              {current.q}
            </h2>

            <div className="qz-opts" role="group" aria-label="Réponses possibles">
              {current.options.map((opt, i) => {
                let cls = "qz-opt";
                if (revealed) {
                  if (i === current.answer) cls += " is-correct";
                  else if (i === selected) cls += " is-wrong";
                  else cls += " is-muted";
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={revealed}
                    onClick={() => answer(i)}
                  >
                    <span className="qz-letter">{LETTERS[i]}</span>
                    <span className="qz-opt-txt">{opt}</span>
                    <span className="qz-opt-ico">
                      {revealed && i === current.answer ? <Icon.Check /> : <Icon.Cross />}
                    </span>
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="qz-feedback" aria-live="polite">
                {selected === current.answer ? (
                  <div className="qz-verdict ok">
                    <Icon.Check /> Bonne réponse
                  </div>
                ) : (
                  <div className="qz-verdict err">
                    <Icon.Cross /> Réponse incorrecte
                  </div>
                )}
                <div className="qz-exp">
                  <span className="qz-exp-ico">
                    <Icon.Brain />
                  </span>
                  <span className="qz-exp-body">{current.exp}</span>
                </div>
                <button className="qz-next" onClick={next}>
                  {index < total - 1 ? "Question suivante" : "Voir les résultats"}
                  <Icon.Arrow />
                </button>
                <div className="qz-clear" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------- RÉSULTATS ----------------------------- */}
      {screen === "results" && (
        <div className="qz-wrap qz-fade">
          <div className="qz-res-emblem">
            <Emblem size={76} />
          </div>
          <h2 className="qz-res-title">Partie terminée</h2>

          <div className="qz-score">
            <div className="qz-score-big">
              {score}/{total}
            </div>
            <div className="qz-score-sub">
              {percentage}% de bonnes réponses · {errors.length} à revoir
            </div>
          </div>
          <p className="qz-tier">{tier(percentage)}</p>

          {breakdown.length > 1 && (
            <>
              <div className="qz-section-label">Résultats par domaine</div>
              <div className="qz-breakdown">
                {breakdown.map((b) => (
                  <div className="qz-bd-row" key={b.id} style={{ "--cat": catColor(b.id) }}>
                    <div className="qz-bd-head">
                      <span className="qz-bd-name">
                        <span className="qz-cat-dot" style={{ width: 11, height: 11, boxShadow: "none", background: catColor(b.id) }} />
                        {CATEGORIES[b.id].short}
                      </span>
                      <span className="qz-bd-score">
                        {b.ok}/{b.n}
                      </span>
                    </div>
                    <div className="qz-bd-track">
                      <div className="qz-bd-fill" style={{ width: `${(b.ok / b.n) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="qz-actions">
            <button className="qz-btn primary" onClick={start}>
              <Icon.Refresh /> Rejouer
            </button>
            <button className="qz-btn" onClick={() => setScreen("home")}>
              <Icon.Grid /> Changer de domaine
            </button>
            <button
              className="qz-btn"
              aria-pressed={showReview}
              onClick={() => setShowReview((s) => !s)}
            >
              <Icon.List /> {showReview ? "Masquer" : "Revoir mes erreurs"}
            </button>
          </div>

          {showReview && (
            <div className="qz-review">
              {errors.length === 0 ? (
                <div className="qz-rev-empty">
                  Sans-faute : aucune erreur à revoir. Bravo !
                </div>
              ) : (
                errors.map((r, i) => (
                  <div className="qz-rev-item" key={i} style={{ "--cat": catColor(r.cat) }}>
                    <div className="qz-rev-cat">{CATEGORIES[r.cat].short}</div>
                    <div className="qz-rev-q">{r.q}</div>
                    <div className="qz-rev-line ko">
                      <Icon.Cross />
                      <span>
                        Votre réponse : {r.options[r.selected]}
                      </span>
                    </div>
                    <div className="qz-rev-line ok">
                      <Icon.Check />
                      <span>
                        Bonne réponse : <b>{r.options[r.answer]}</b>
                      </span>
                    </div>
                    <div className="qz-rev-exp">{r.exp}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
