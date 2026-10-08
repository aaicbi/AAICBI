/**
 * The controls (other than menu items) that carry a data-guide-target id, so
 * the Command Center can offer them when someone writes "Show me" knowledge,
 * and a test keeps the list honest: every id here must exist in the code.
 * To make a new control pointable, add data-guide-target="its-id" to it and
 * list it here.
 */
export interface ControlTarget {
  id: string;
  label: string;
  /** The page it lives on. */
  page: string;
}

export const CONTROL_TARGETS: ControlTarget[] = [
  { id: "create-course", label: "+ Create Course button", page: "/admin/courses" },
  { id: "course-title", label: "Course Title field", page: "/admin/courses/new" },
  { id: "course-description", label: "Course Description field", page: "/admin/courses/new" },
  { id: "create-course-submit", label: "Create & Add Modules button", page: "/admin/courses/new" },
  { id: "add-module", label: "+ Add Module button", page: "/admin/courses" },
  { id: "preview-as-trainee", label: "Preview as Trainee link", page: "/admin/courses" },
  { id: "course-status", label: "Course Status selector (publish)", page: "/admin/courses" },
  { id: "more", label: "More menu button (phone bottom bar)", page: "/" },
];
