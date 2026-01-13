import type { NodeInput, NodeOutput } from './types';

interface PresetConfig {
  label: string;
  prompt: string;
  inputs: Omit<NodeInput, 'id'>[];
  outputs: Omit<NodeOutput, 'id'>[];
}

export const PRESET_CONFIGS: Record<string, PresetConfig> = {
    'to-figure': {
        label: 'Image to Figure',
        prompt: 'turn this photo into a character figure. Behind it, place a box with the character’s image printed on it, and a computer showing the Blender modeling process on its screen. In front of the box, add a round plastic base with the character figure standing on it. set the scene indoors if possible',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'change-angle': {
        label: 'Change Perspective',
        prompt: 'change the Camera anglo a high-angled selfie perspective looking down at the woman, while preserving her exact facial features, expression, and clothing, Maintain the same living room interior background with the sofa, natural lighting, and overall photographic composition and style.',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'arch-to-model': {
        label: 'Architecture to Model',
        prompt: 'convert this photo into a architecture model. Behind the model, there should be a cardboard box with an image of the architecture from the photo on it. There should also be a computer, with the content on the computer screen showing the Blender modeling process of the figurine. In front of the cardboard box, place a cardstock and put the architecture model from the photo I provided on it. I hope the PVC material can be clearly presented. It would be even better if the background is indoors.',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'combine-objects': {
        label: 'Combine Objects',
        prompt: 'Combine them',
        inputs: [{ label: 'Image 1', type: 'image' }, { label: 'Image 2', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'high-res': {
        label: 'High Res Fix',
        prompt: 'Enhance this image to high resolution',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-line-art': {
        label: 'Image to Line Art',
        prompt: 'Turn into hand-drawn line art',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'colorize-by-palette': {
        label: 'Colorize by Palette',
        prompt: 'Colorize accurately using the palette',
        inputs: [{ label: 'Image', type: 'image' }, { label: 'Palette', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'generate-char-sheet': {
        label: 'Generate Character Sheet',
        prompt: 'Generate a character design sheet for me: Proportions (height comparison, head-to-body ratio), Three-view drawing (front, side, back), Expression Sheet, Pose Sheet → various common poses, Costume Design',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'virtual-real-combo': {
        label: 'Virtual-Real Combo',
        prompt: 'Add a couple sitting in the seats happily drinking coffee and talking, the characters are in a rough sketch cute illustration style',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'anime-to-real': {
        label: 'Anime to Real',
        prompt: 'Generate a highly detailed photo of a girl cosplaying this illustration, at Comiket. Exactly replicate the same pose, body posture, hand gestures, facial expression, and camera framing as in the original illustration. Keep the same angle, perspective, and composition, without any deviation',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'pose-reference': {
        label: 'Pose Reference',
        prompt: 'Change the person to the pose in the reference image accurately, professional studio photography',
        inputs: [{ label: 'Person', type: 'image' }, { label: 'Pose', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-action-figure': {
        label: 'Image to Action Figure',
        prompt: "Transform the person in the photo into a highly detailed action figure. Place the action figure inside its original toy packaging box, which should be styled like a collectible item. The box should have dynamic artwork and a clear plastic window showing the figure. Place the box in a clean, professional studio environment, like for a product photoshoot. Visualize this in a highly realistic way with attention to fine details on both the figure and the packaging.",
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-funko-pop': {
        label: 'Image to Funko Pop',
        prompt: "Transform the person in the photo into the style of a Funko Pop figure packaging box, presented in an isometric perspective. Label the packaging with the title 'ZHOGUE'. Inside the box, showcase the figure based on the person in the photo, accompanied by their essential items (such as cosmetics, bags, or others). Next to the box, also display the actual figure itself outside of the packaging, rendered in a realistic and lifelike style.",
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-lego': {
        label: 'Image to LEGO',
        prompt: "Transform the person in the photo into the style of a LEGO minifigure packaging box, presented in an isometric perspective. Label the packaging with the title 'ZHOGUE'. Inside the box, showcase the LEGO minifigure based on the person in the photo, accompanied by their essential items (such as cosmetics, bags, or others) as LEGO accessories. Next to the box, also display the actual LEGO minifigure itself outside of the packaging, rendered in a realistic and lifelike style.",
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-knit-doll': {
        label: 'Image to Knitted Doll',
        prompt: 'A close-up, professionally composed photograph showing a handmade crocheted yarn doll being gently held in both hands. The doll has a rounded shape and an adorable chibi-style appearance, with vivid color contrasts and rich details. The hands holding the doll appear natural and tender, with clearly visible finger posture, and the skin texture and light-shadow transitions look soft and realistic, conveying a warm, tangible touch. The background is slightly blurred, depicting an indoor setting with a warm wooden tabletop and natural light streaming in through a window, creating a cozy and intimate atmosphere. The overall image conveys a sense of exquisite craftsmanship and a cherished, heartwarming emotion.',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-barbie': {
        label: 'Image to Barbie',
        prompt: "Transform the person in the photo into the style of a Barbie doll packaging box, presented in an isometric perspective. Label the packaging with the title 'ZHOGUE'. Inside the box, showcase the Barbie doll version of the person from the photo, accompanied by their essential items (such as cosmetics, bags, or others) designed as stylish Barbie accessories. Next to the box, also display the actual Barbie doll itself outside of the packaging, rendered in a realistic and lifelike style, resembling official Barbie promotional renders",
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-gundam': {
        label: 'Everything to Gundam',
        prompt: "Transform the person in the photo into the style of a Gundam model kit packaging box, presented in an isometric perspective. Label the packaging with the title 'ZHOGUE'. Inside the box, showcase a Gundam-style mecha version of the person from the photo, accompanied by their essential items (such as cosmetics, bags, or others) redesigned as futuristic mecha accessories. The packaging should resemble authentic Gunpla boxes, with technical illustrations, instruction-manual style details, and sci-fi typography. Next to the box, also display the actual Gundam-style mecha figure itself outside of the packaging, rendered in a realistic and lifelike style, similar to official Bandai promotional renders.",
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'generate-child': {
        label: 'Generate Child',
        prompt: 'Generate what the child of the two people in the image would look like, professional photography',
        inputs: [{ label: 'Parent 1', type: 'image' }, { label: 'Parent 2', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'product-render': {
        label: 'Product Design to Render',
        prompt: 'turn this illustration of a perfume into a realistic version, Frosted glass bottle with a marble cap',
        inputs: [{ label: 'Design', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'pro-photo': {
        label: 'Pro Photography Style',
        prompt: 'Transform the person in the photo into highly stylized ultra-realistic portrait, with sharp facial features and flawless fair skin, standing confidently against a bold green gradient background. Dramatic, cinematic lighting highlights her facial structure, evoking the look of a luxury fashion magazine cover. Editorial photography style, high-detail, 4K resolution, symmetrical composition, minimalistic background',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'lighting-reference': {
        label: 'Lighting Reference',
        prompt: 'Change the lighting of the original image to match the reference image, professional photography',
        inputs: [{ label: 'Subject', type: 'image' }, { label: 'Light Ref', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'generate-process': {
        label: 'Generate Drawing Process',
        prompt: 'Generate a 4-panel drawing process for the character. Step 1: Line art, Step 2: Flat colors, Step 3: Add shadows, Step 4: Refine and finish. No text.',
        inputs: [{ label: 'Subject', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-realistic': {
        label: 'To Realistic Style',
        prompt: 'turn this illustration into realistic version',
        inputs: [{ label: 'Image', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'to-keychain': {
        label: 'Image to Keychain',
        prompt: 'Turn this photo into a cute keychain hanging on the bag in the photo',
        inputs: [{ label: 'Subject & Bag', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'add-effect': {
        label: 'Add Effect',
        prompt: 'Overlay the effect from the effect image onto the base image',
        inputs: [{ label: 'Base', type: 'image' }, { label: 'Effect', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'product-packaging': {
        label: 'Product Packaging',
        prompt: 'Apply the image onto the packaging box, placed in a minimalist setting, professional photography',
        inputs: [{ label: 'Sticker', type: 'image' }, { label: 'Box', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'virtual-makeup': {
        label: 'Virtual Makeup',
        prompt: 'Apply the makeup from the image to the person, keeping the original pose',
        inputs: [{ label: 'Face', type: 'image' }, { label: 'Makeup', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
    'expression-reference': {
        label: 'Expression Reference',
        prompt: 'Change the person\'s expression to match the new image',
        inputs: [{ label: 'Face', type: 'image' }, { label: 'Expression', type: 'image' }],
        outputs: [{ label: 'Image', type: 'image' }]
    },
};