// src/database/naming.strategy.ts
import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function aSnake(texto: string): string {
  return texto
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Las columnas viven en snake_case en Postgres; las propiedades de las
 * entidades siguen siendo camelCase. Esta estrategia hace la traducción
 * para que ninguna entidad tenga que repetir `name:` en cada columna.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? aSnake(targetName);
  }

  columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const prefijo = embeddedPrefixes.map(aSnake).join('_');
    const base = customName ?? aSnake(propertyName);
    return prefijo ? `${prefijo}_${base}` : base;
  }

  relationName(propertyName: string): string {
    return aSnake(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return aSnake(`${relationName}_${referencedColumnName}`);
  }

  joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return aSnake(`${tableName}_${columnName ?? propertyName}`);
  }
}
