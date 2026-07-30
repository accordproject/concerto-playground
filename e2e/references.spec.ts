import { test, expect } from '@playwright/test';
import LZString from 'lz-string';

// Clickable references must decorate only real type-reference positions:
// the type after o / --> / extends and import targets. Declaration names
// get their own navigable decoration, styled apart from references. The
// same word used as a property name, enum value or inside a comment must
// stay plain text.
const REFS_CTO = `namespace org.refs@1.0.0

/**
 * Person also appears in this comment
 */
concept Person identified by id {
  o String id
}

enum Roles {
  o Person
}

concept Employee extends Person {
  o Person Person
}

asset Badge identified by bid {
  o String bid
  --> Person holder
}
`;

const WORKSPACE_HASH = LZString.compressToEncodedURIComponent(JSON.stringify([REFS_CTO]));

test.describe('Clickable reference decorations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#' + WORKSPACE_HASH);
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.view-lines').first()).toContainText('Employee', { timeout: 15000 });
  });

  test('only type positions are underlined, not names, values or comments', async ({ page }) => {
    // Exactly three "Person" occurrences are references: after extends,
    // after o and after -->. The property name, the enum value and the
    // block-comment mention must carry no reference decoration.
    await expect
      .poll(
        async () => (await page.locator('.view-lines .concerto-type-link').allTextContents()).join(''),
        { timeout: 10000 },
      )
      .toBe('PersonPersonPerson');
  });

  test('declaration names carry the declaration decoration', async ({ page }) => {
    // Each declared name is navigable exactly once, at its declaration
    // header; enum values and the comment mention stay undecorated.
    await expect
      .poll(
        async () => (await page.locator('.view-lines .concerto-type-decl').allTextContents()).join(','),
        { timeout: 10000 },
      )
      .toBe('Person,Roles,Employee,Badge');
  });

  test('clicking a decorated reference still navigates to the declaration', async ({ page }) => {
    await page.locator('.view-lines .concerto-type-link').first().click();
    await expect(page.locator('.concept-node.selected', { hasText: 'Person' })).toBeVisible({ timeout: 5000 });
  });

  test('clicking a declaration name selects its own node in the graph', async ({ page }) => {
    await page.locator('.view-lines .concerto-type-decl', { hasText: 'Employee' }).click();
    await expect(page.locator('.concept-node.selected', { hasText: 'Employee' })).toBeVisible({ timeout: 5000 });
  });
});
