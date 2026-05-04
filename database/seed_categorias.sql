-- ============================================================
-- SEED: Categorías de Alimentos
-- Basado en la Tabla Peruana de Composición de Alimentos (TPCA)
-- Centro Nacional de Alimentación y Nutrición (CENAN/INS)
-- ============================================================

INSERT INTO categorias_alimentos (codigo, nombre, descripcion, icono, orden) VALUES
('CAT01', 'Cereales y derivados', 'Arroz, trigo, maíz, avena, quinua, kiwicha, cañihua, fideos, harinas, panes', '🌾', 1),
('CAT02', 'Verduras, hortalizas y derivados', 'Tomate, cebolla, zanahoria, espinaca, brócoli, lechuga, zapallo, apio, pimiento', '🥬', 2),
('CAT03', 'Frutas y derivados', 'Manzana, plátano, naranja, mandarina, papaya, piña, mango, aguaymanto, lúcuma, chirimoya', '🍎', 3),
('CAT04', 'Grasas, aceites y oleaginosas', 'Aceite de oliva, aceite vegetal, mantequilla, margarina, maní, pecanas, sacha inchi', '🫒', 4),
('CAT05', 'Pescados y mariscos', 'Bonito, jurel, caballa, merluza, trucha, pejerrey, camarones, conchas, calamar', '🐟', 5),
('CAT06', 'Carnes y derivados', 'Pollo, res, cerdo, cordero, cuy, alpaca, hígado, embutidos', '🥩', 6),
('CAT07', 'Leche y derivados', 'Leche fresca, leche evaporada, yogurt, queso fresco, queso andino, mantequilla', '🥛', 7),
('CAT08', 'Huevos y derivados', 'Huevo de gallina, huevo de codorniz, huevo de pato', '🥚', 8),
('CAT09', 'Leguminosas y derivados', 'Frijoles, lentejas, garbanzos, pallares, habas, arvejas secas, tarwi/chocho', '🫘', 9),
('CAT10', 'Tubérculos, raíces y derivados', 'Papa, camote, yuca, olluco, oca, mashua, chuño, papa seca', '🥔', 10),
('CAT11', 'Azúcares y derivados', 'Azúcar rubia, azúcar blanca, miel, chancaca, panela, mermeladas', '🍯', 11),
('CAT12', 'Misceláneos', 'Condimentos, especias, hierbas aromáticas, ají, rocoto, huacatay, achiote', '🌿', 12),
('CAT13', 'Bebidas', 'Chicha morada, emoliente, infusiones, jugos, néctares', '🥤', 13),
('CAT14', 'Preparaciones y comidas', 'Platos típicos preparados, sopas, guisos, ceviches, estofados', '🍲', 14);

-- ============================================================
-- SEED: Alimentos de ejemplo (muestra representativa)
-- Datos basados en la TPCA - por 100g de porción comestible
-- ============================================================

-- Cereales y derivados
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, hierro_mg, zinc_mg, sodio_mg, potasio_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('C001', 'Quinua, grano seco', 'Quinua', 1, 343.0, 11.8, 13.6, 5.8, 66.6, 57.2, 9.4, 2.2, 56.0, 387.0, 7.5, 3.3, 12.0, 926.0, 0.0, 53, 'MEDIO', 'Sierra'),
('C002', 'Kiwicha, grano seco', 'Kiwicha', 1, 343.0, 12.0, 12.8, 6.5, 65.1, 59.8, 5.3, 3.6, 236.0, 453.0, 7.3, 3.2, 1.0, 484.0, 1.3, 35, 'MEDIO', 'Sierra'),
('C003', 'Avena, hojuelas', 'Avena', 1, 379.0, 8.2, 12.3, 7.1, 67.7, 57.6, 10.1, 4.7, 54.0, 410.0, 4.2, 3.6, 6.0, 362.0, 0.0, 55, 'BAJO', 'Nacional'),
('C004', 'Arroz, grano pulido crudo', 'Arroz blanco', 1, 359.0, 13.0, 7.4, 0.4, 78.9, 78.2, 0.7, 0.3, 2.0, 104.0, 1.0, 1.2, 0.0, 84.0, 0.0, 73, 'BAJO', 'Costa'),
('C005', 'Cañihua, grano seco', 'Cañihua', 1, 342.0, 12.2, 14.0, 4.3, 64.0, 56.5, 7.5, 5.5, 87.0, 335.0, 12.0, 4.5, 2.0, 540.0, 1.1, 45, 'MEDIO', 'Sierra'),
('C006', 'Arroz integral, grano seco', 'Arroz integral', 1, 362.0, 12.0, 7.5, 2.7, 76.2, 68.4, 7.8, 1.6, 20.0, 280.0, 1.8, 2.0, 7.0, 250.0, 0.0, 50, 'MEDIO', 'Costa'),
('C007', 'Trigo, grano seco', 'Trigo', 1, 336.0, 12.5, 10.5, 2.0, 73.0, 66.0, 7.0, 2.0, 36.0, 340.0, 3.5, 2.8, 2.0, 370.0, 0.0, 41, 'BAJO', 'Sierra');

-- Verduras y hortalizas
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('V001', 'Espinaca, hojas', 'Espinaca', 2, 26.0, 90.0, 2.6, 0.5, 4.9, 1.6, 3.3, 2.0, 93.0, 55.0, 2.4, 33.0, 15, 'BAJO', 'Nacional'),
('V002', 'Brócoli, inflorescencia', 'Brócoli', 2, 25.0, 91.0, 2.8, 0.4, 4.4, 1.8, 2.6, 1.4, 58.0, 60.0, 0.6, 89.0, 15, 'MEDIO', 'Nacional'),
('V003', 'Tomate, fruto maduro', 'Tomate', 2, 19.0, 94.0, 1.0, 0.2, 4.2, 2.8, 1.4, 0.6, 11.0, 25.0, 0.6, 23.0, 15, 'BAJO', 'Nacional'),
('V004', 'Zanahoria, raíz', 'Zanahoria', 2, 38.0, 89.0, 0.7, 0.2, 9.2, 6.6, 2.6, 0.9, 31.0, 28.0, 0.4, 5.0, 47, 'BAJO', 'Nacional'),
('V005', 'Zapallo macre', 'Zapallo', 2, 16.0, 94.0, 0.5, 0.1, 4.0, 3.0, 1.0, 0.4, 28.0, 17.0, 0.4, 9.0, 75, 'BAJO', 'Nacional'),
('V006', 'Cebolla, bulbo', 'Cebolla', 2, 35.0, 90.0, 0.9, 0.1, 8.6, 7.0, 1.6, 0.4, 20.0, 33.0, 0.3, 6.0, 10, 'BAJO', 'Nacional'),
('V007', 'Ají amarillo, fruto', 'Ají amarillo', 2, 39.0, 88.0, 0.9, 0.7, 8.8, 6.3, 2.5, 0.6, 31.0, 36.0, 0.9, 60.0, 15, 'BAJO', 'Nacional'),
('V008', 'Pimiento, fruto rojo', 'Pimiento', 2, 25.0, 92.0, 0.9, 0.2, 5.9, 4.2, 1.7, 0.6, 8.0, 22.0, 0.4, 128.0, 15, 'BAJO', 'Nacional');

-- Frutas
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('F001', 'Aguaymanto, fruto', 'Aguaymanto', 3, 54.0, 79.6, 1.5, 0.5, 18.5, 13.1, 5.4, 0.7, 7.0, 37.0, 0.8, 26.0, 25, 'MEDIO', 'Sierra'),
('F002', 'Manzana, fruto', 'Manzana', 3, 56.0, 84.0, 0.2, 0.1, 15.2, 12.6, 2.6, 0.5, 6.0, 12.0, 0.4, 8.0, 36, 'BAJO', 'Nacional'),
('F003', 'Palta fuerte, pulpa', 'Palta', 3, 131.0, 79.2, 1.7, 12.5, 5.6, 1.8, 3.8, 1.0, 30.0, 67.0, 0.6, 12.0, 15, 'MEDIO', 'Costa'),
('F004', 'Naranja, jugo', 'Naranja', 3, 40.0, 89.0, 0.6, 0.1, 10.1, 8.9, 1.2, 0.2, 23.0, 18.0, 0.2, 48.0, 43, 'BAJO', 'Nacional'),
('F005', 'Plátano de seda, pulpa', 'Plátano', 3, 83.0, 75.0, 1.1, 0.2, 22.8, 20.2, 2.6, 0.9, 7.0, 26.0, 0.4, 12.0, 51, 'BAJO', 'Selva'),
('F006', 'Papaya, pulpa', 'Papaya', 3, 32.0, 90.7, 0.5, 0.1, 8.2, 6.9, 1.3, 0.5, 24.0, 15.0, 0.3, 47.0, 60, 'BAJO', 'Selva'),
('F007', 'Lúcuma, pulpa', 'Lúcuma', 3, 99.0, 72.3, 1.5, 0.5, 25.0, 22.0, 3.0, 0.7, 16.0, 26.0, 0.4, 2.0, 40, 'ALTO', 'Costa'),
('F008', 'Guayaba, pulpa', 'Guayaba', 3, 36.0, 86.0, 0.8, 0.6, 12.0, 8.9, 3.1, 0.6, 18.0, 23.0, 0.5, 228.0, 20, 'BAJO', 'Selva');

-- Pescados y mariscos
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, fibra_dietaria_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('P001', 'Bonito, músculo', 'Bonito', 5, 138.0, 70.8, 23.4, 5.1, 0.0, 0.0, 32.0, 190.0, 0.8, 0.0, 0, 'MEDIO', 'Costa'),
('P002', 'Jurel, músculo', 'Jurel', 5, 96.0, 77.0, 19.7, 2.0, 0.0, 0.0, 27.0, 231.0, 0.8, 0.0, 0, 'BAJO', 'Costa'),
('P003', 'Trucha, músculo', 'Trucha', 5, 89.0, 78.4, 18.7, 1.5, 0.0, 0.0, 14.0, 245.0, 0.3, 0.0, 0, 'MEDIO', 'Sierra'),
('P004', 'Caballa, músculo', 'Caballa', 5, 142.0, 70.0, 19.3, 7.1, 0.0, 0.0, 12.0, 200.0, 1.2, 0.0, 0, 'MEDIO', 'Costa');

-- Carnes
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, fibra_dietaria_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('M001', 'Pollo, pechuga sin piel', 'Pechuga de pollo', 6, 107.0, 74.8, 23.3, 1.2, 0.0, 0.0, 12.0, 173.0, 0.4, 0.0, 0, 'MEDIO', 'Nacional'),
('M002', 'Res, pulpa', 'Carne de res', 6, 105.0, 75.9, 21.3, 2.0, 0.0, 0.0, 7.0, 185.0, 2.3, 0.0, 0, 'ALTO', 'Nacional'),
('M003', 'Cuy, carne', 'Cuy', 6, 96.0, 78.1, 19.0, 1.6, 0.5, 0.0, 29.0, 258.0, 1.9, 0.0, 0, 'ALTO', 'Sierra'),
('M004', 'Hígado de res', 'Hígado', 6, 136.0, 70.8, 19.8, 3.8, 3.9, 0.0, 6.0, 358.0, 5.4, 23.0, 0, 'MEDIO', 'Nacional'),
('M005', 'Alpaca, pulpa', 'Carne de alpaca', 6, 101.0, 76.0, 21.0, 1.5, 0.0, 0.0, 8.0, 198.0, 2.1, 0.0, 0, 'MEDIO', 'Sierra');

-- Leche y derivados
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('L001', 'Leche fresca de vaca', 'Leche fresca', 7, 60.0, 88.0, 3.1, 3.2, 5.0, 5.0, 0.0, 106.0, 91.0, 0.1, 1.0, 27, 'BAJO', 'Nacional'),
('L002', 'Yogurt natural', 'Yogurt natural', 7, 56.0, 87.9, 5.7, 0.7, 7.8, 7.8, 0.0, 183.0, 144.0, 0.1, 1.0, 36, 'MEDIO', 'Nacional'),
('L003', 'Queso fresco de vaca', 'Queso fresco', 7, 263.0, 55.0, 17.5, 20.1, 3.3, 3.3, 0.0, 263.0, 100.0, 0.7, 0.0, 0, 'MEDIO', 'Nacional');

-- Huevos
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, fibra_dietaria_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('H001', 'Huevo de gallina, entero', 'Huevo', 8, 150.0, 75.0, 11.8, 11.1, 0.9, 0.0, 48.0, 184.0, 1.5, 0.0, 0, 'BAJO', 'Nacional');

-- Leguminosas
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('LG01', 'Frijol canario, grano seco', 'Frijol canario', 9, 339.0, 12.0, 19.8, 1.6, 62.5, 46.3, 16.2, 4.1, 120.0, 408.0, 5.6, 4.0, 28, 'BAJO', 'Nacional'),
('LG02', 'Lenteja, grano seco', 'Lenteja', 9, 338.0, 10.4, 23.0, 1.8, 60.7, 48.5, 12.2, 4.1, 79.0, 412.0, 7.6, 3.0, 26, 'BAJO', 'Nacional'),
('LG03', 'Garbanzo, grano seco', 'Garbanzo', 9, 355.0, 9.9, 21.2, 4.9, 60.1, 50.6, 9.5, 3.9, 134.0, 318.0, 4.9, 3.0, 28, 'BAJO', 'Nacional'),
('LG04', 'Pallar, grano seco', 'Pallar', 9, 304.0, 14.3, 19.5, 0.8, 62.0, 47.8, 14.2, 3.4, 97.0, 355.0, 6.7, 0.0, 31, 'BAJO', 'Costa'),
('LG05', 'Tarwi/chocho, grano seco', 'Tarwi', 9, 458.0, 7.7, 44.3, 16.5, 28.2, 18.6, 9.6, 3.3, 54.0, 440.0, 3.6, 0.0, 15, 'BAJO', 'Sierra'),
('LG06', 'Habas secas', 'Habas', 9, 337.0, 11.2, 24.3, 1.3, 58.6, 44.2, 14.4, 4.6, 115.0, 370.0, 5.1, 2.0, 40, 'BAJO', 'Sierra');

-- Tubérculos y raíces
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, carbohidratos_disponibles_g, fibra_dietaria_g, cenizas_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('T001', 'Papa blanca, tubérculo', 'Papa blanca', 10, 97.0, 74.5, 2.1, 0.1, 22.3, 20.1, 2.2, 1.0, 6.0, 52.0, 0.5, 14.0, 77, 'BAJO', 'Nacional'),
('T002', 'Camote amarillo, tubérculo', 'Camote', 10, 116.0, 69.9, 1.2, 0.2, 27.6, 24.1, 3.5, 1.1, 41.0, 38.0, 0.7, 10.0, 61, 'BAJO', 'Nacional'),
('T003', 'Yuca blanca, raíz', 'Yuca', 10, 162.0, 59.0, 0.7, 0.2, 39.2, 37.0, 2.2, 0.9, 40.0, 34.0, 0.4, 28.0, 46, 'BAJO', 'Selva'),
('T004', 'Olluco, tubérculo', 'Olluco', 10, 62.0, 83.7, 1.1, 0.1, 14.3, 12.5, 1.8, 0.8, 3.0, 28.0, 1.1, 11.0, 55, 'BAJO', 'Sierra'),
('T005', 'Oca, tubérculo', 'Oca', 10, 61.0, 84.1, 1.0, 0.1, 14.0, 12.2, 1.8, 0.8, 2.0, 36.0, 1.6, 38.0, 58, 'BAJO', 'Sierra');

-- Oleaginosas y grasas saludables
INSERT INTO alimentos (codigo_tpca, nombre, nombre_comun, categoria_id, energia_kcal, agua_g, proteinas_g, grasas_totales_g, carbohidratos_totales_g, fibra_dietaria_g, calcio_mg, fosforo_mg, hierro_mg, vitamina_c_mg, indice_glucemico, costo_aproximado, origen_region) VALUES
('G001', 'Sacha inchi, semilla', 'Sacha inchi', 4, 555.0, 3.3, 27.0, 48.7, 18.0, 4.0, 362.0, 400.0, 3.3, 0.0, 0, 'ALTO', 'Selva'),
('G002', 'Maní, tostado sin sal', 'Maní', 4, 595.0, 1.5, 25.2, 50.6, 17.4, 8.5, 54.0, 362.0, 1.8, 0.0, 14, 'BAJO', 'Nacional'),
('G003', 'Aceite de oliva', 'Aceite de oliva', 4, 884.0, 0.0, 0.0, 100.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, 'ALTO', 'Nacional');

-- ============================================================
-- Verificación de datos insertados
-- ============================================================
-- SELECT ca.nombre AS categoria, COUNT(a.id) AS total_alimentos
-- FROM categorias_alimentos ca
-- LEFT JOIN alimentos a ON ca.id = a.categoria_id
-- GROUP BY ca.nombre, ca.orden
-- ORDER BY ca.orden;
