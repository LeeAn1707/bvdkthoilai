export const id = '20261102_086_restore_cascade_foreign_keys_and_sync_sequences'
export const description = 'Khôi phục đầy đủ khóa ngoại ON DELETE CASCADE cho toàn bộ bảng mảng lồng nhau (nested arrays / versions / rels) và đồng bộ lại toàn bộ sequences'
export const transactional = false

// Danh sách đầy đủ 231 khóa ngoại cha-con (_parent_id / parent_id) chuẩn từ Payload generated schema
const PARENT_CASCADE_FKS = [
  ['users_permissions_actions', 'parent_id', 'users_permissions', 'id', 'users_permissions_actions_parent_fk'],
  ['users_permissions', '_parent_id', 'users', 'id', 'users_permissions_parent_id_fk'],
  ['news_attachments', '_parent_id', 'news', 'id', 'news_attachments_parent_id_fk'],
  ['_news_v_version_attachments', '_parent_id', '_news_v', 'id', '_news_v_version_attachments_parent_id_fk'],
  ['notices_attachments', '_parent_id', 'notices', 'id', 'notices_attachments_parent_id_fk'],
  ['_notices_v_version_attachments', '_parent_id', '_notices_v', 'id', '_notices_v_version_attachments_parent_id_fk'],
  ['health_warnings_attachments', '_parent_id', 'health_warnings', 'id', 'health_warnings_attachments_parent_id_fk'],
  ['_health_warnings_v_version_attachments', '_parent_id', '_health_warnings_v', 'id', '_health_warnings_v_version_attachments_parent_id_fk'],
  ['procurement_attachments', '_parent_id', 'procurement', 'id', 'procurement_attachments_parent_id_fk'],
  ['procurement_change_log', '_parent_id', 'procurement', 'id', 'procurement_change_log_parent_id_fk'],
  ['_procurement_v_version_attachments', '_parent_id', '_procurement_v', 'id', '_procurement_v_version_attachments_parent_id_fk'],
  ['_procurement_v_version_change_log', '_parent_id', '_procurement_v', 'id', '_procurement_v_version_change_log_parent_id_fk'],
  ['clinical_protocols_rels', 'parent_id', 'clinical_protocols', 'id', 'clinical_protocols_rels_parent_fk'],
  ['_clinical_protocols_v_rels', 'parent_id', '_clinical_protocols_v', 'id', '_clinical_protocols_v_rels_parent_fk'],
  ['departments_deputy_leaders', '_parent_id', 'departments', 'id', 'departments_deputy_leaders_parent_id_fk'],
  ['departments_gallery', '_parent_id', 'departments', 'id', 'departments_gallery_parent_id_fk'],
  ['specialties_sidebar_banners', '_parent_id', 'specialties', 'id', 'specialties_sidebar_banners_parent_id_fk'],
  ['_specialties_v_version_sidebar_banners', '_parent_id', '_specialties_v', 'id', '_specialties_v_version_sidebar_banners_parent_id_fk'],
  ['schedules_daily_assignments', '_parent_id', 'schedules', 'id', 'schedules_daily_assignments_parent_id_fk'],
  ['schedules_nurse_assignments', '_parent_id', 'schedules', 'id', 'schedules_nurse_assignments_parent_id_fk'],
  ['schedules_weekly_dept_slots', '_parent_id', 'schedules', 'id', 'schedules_weekly_dept_slots_parent_id_fk'],
  ['schedules_emergency_contacts', '_parent_id', 'schedules', 'id', 'schedules_emergency_contacts_parent_id_fk'],
  ['schedules_attachment_files', '_parent_id', 'schedules', 'id', 'schedules_attachment_files_parent_id_fk'],
  ['schedules_weekly_slots', '_parent_id', 'schedules', 'id', 'schedules_weekly_slots_parent_id_fk'],
  ['work_schedules_days', '_parent_id', 'work_schedules', 'id', 'work_schedules_days_parent_id_fk'],
  ['_work_schedules_v_version_days', '_parent_id', '_work_schedules_v', 'id', '_work_schedules_v_version_days_parent_id_fk'],
  ['recruitment_attachments', '_parent_id', 'recruitment', 'id', 'recruitment_attachments_parent_id_fk'],
  ['_recruitment_v_version_attachments', '_parent_id', '_recruitment_v', 'id', '_recruitment_v_version_attachments_parent_id_fk'],
  ['pages_blocks_rich_text', '_parent_id', 'pages', 'id', 'pages_blocks_rich_text_parent_id_fk'],
  ['pages_blocks_image_text', '_parent_id', 'pages', 'id', 'pages_blocks_image_text_parent_id_fk'],
  ['pages_blocks_gallery_images', '_parent_id', 'pages_blocks_gallery', 'id', 'pages_blocks_gallery_images_parent_id_fk'],
  ['pages_blocks_gallery', '_parent_id', 'pages', 'id', 'pages_blocks_gallery_parent_id_fk'],
  ['pages_blocks_faq_items', '_parent_id', 'pages_blocks_faq', 'id', 'pages_blocks_faq_items_parent_id_fk'],
  ['pages_blocks_faq', '_parent_id', 'pages', 'id', 'pages_blocks_faq_parent_id_fk'],
  ['pages_blocks_downloads_items', '_parent_id', 'pages_blocks_downloads', 'id', 'pages_blocks_downloads_items_parent_id_fk'],
  ['pages_blocks_downloads', '_parent_id', 'pages', 'id', 'pages_blocks_downloads_parent_id_fk'],
  ['pages_attachments', '_parent_id', 'pages', 'id', 'pages_attachments_parent_id_fk'],
  ['_pages_v_blocks_rich_text', '_parent_id', '_pages_v', 'id', '_pages_v_blocks_rich_text_parent_id_fk'],
  ['_pages_v_blocks_image_text', '_parent_id', '_pages_v', 'id', '_pages_v_blocks_image_text_parent_id_fk'],
  ['_pages_v_blocks_gallery_images', '_parent_id', '_pages_v_blocks_gallery', 'id', '_pages_v_blocks_gallery_images_parent_id_fk'],
  ['_pages_v_blocks_gallery', '_parent_id', '_pages_v', 'id', '_pages_v_blocks_gallery_parent_id_fk'],
  ['_pages_v_blocks_faq_items', '_parent_id', '_pages_v_blocks_faq', 'id', '_pages_v_blocks_faq_items_parent_id_fk'],
  ['_pages_v_blocks_faq', '_parent_id', '_pages_v', 'id', '_pages_v_blocks_faq_parent_id_fk'],
  ['_pages_v_blocks_downloads_items', '_parent_id', '_pages_v_blocks_downloads', 'id', '_pages_v_blocks_downloads_items_parent_id_fk'],
  ['_pages_v_blocks_downloads', '_parent_id', '_pages_v', 'id', '_pages_v_blocks_downloads_parent_id_fk'],
  ['_pages_v_version_attachments', '_parent_id', '_pages_v', 'id', '_pages_v_version_attachments_parent_id_fk'],
  ['consult_msgs', '_parent_id', 'consultations', 'id', 'consult_msgs_parent_id_fk'],
  ['forms_fields', '_parent_id', 'forms', 'id', 'forms_fields_parent_id_fk'],
  ['chatbot_intents_phrases', '_parent_id', 'chatbot_intents', 'id', 'chatbot_intents_phrases_parent_id_fk'],
  ['chatbot_conversations_messages', '_parent_id', 'chatbot_conversations', 'id', 'chatbot_conversations_messages_parent_id_fk'],
  ['survey_template_versions_rels', 'parent_id', 'survey_template_versions', 'id', 'survey_template_versions_rels_parent_fk'],
  ['survey_questions_options', '_parent_id', 'survey_questions', 'id', 'survey_questions_options_parent_id_fk'],
  ['survey_campaigns_custom_questions', '_parent_id', 'survey_campaigns', 'id', 'survey_campaigns_custom_questions_parent_id_fk'],
  ['custom_posts_attachments', '_parent_id', 'custom_posts', 'id', 'custom_posts_attachments_parent_id_fk'],
  ['_custom_posts_v_version_attachments', '_parent_id', '_custom_posts_v', 'id', '_custom_posts_v_version_attachments_parent_id_fk'],
  ['advanced_techniques_advantages', '_parent_id', 'advanced_techniques', 'id', 'advanced_techniques_advantages_parent_id_fk'],
  ['advanced_techniques_attachments', '_parent_id', 'advanced_techniques', 'id', 'advanced_techniques_attachments_parent_id_fk'],
  ['scientific_activities_attachments', '_parent_id', 'scientific_activities', 'id', 'scientific_activities_attachments_parent_id_fk'],
  ['_scientific_activities_v_version_attachments', '_parent_id', '_scientific_activities_v', 'id', '_scientific_activities_v_version_attachments_parent_id_fk'],
  ['payload_locked_documents_rels', 'parent_id', 'payload_locked_documents', 'id', 'payload_locked_documents_rels_parent_fk'],
  ['payload_preferences_rels', 'parent_id', 'payload_preferences', 'id', 'payload_preferences_rels_parent_fk'],
  ['site_settings_header_contact_cards', '_parent_id', 'site_settings', 'id', 'site_settings_header_contact_cards_parent_id_fk'],
  ['site_settings_header_social_links', '_parent_id', 'site_settings', 'id', 'site_settings_header_social_links_parent_id_fk'],
  ['ef_steps', '_parent_id', 'ef_tabs', 'id', 'ef_steps_parent_id_fk'],
  ['ef_tabs', '_parent_id', 'site_settings', 'id', 'ef_tabs_parent_id_fk'],
  ['ef_checks', '_parent_id', 'site_settings', 'id', 'ef_checks_parent_id_fk'],
  ['ef_prios', '_parent_id', 'site_settings', 'id', 'ef_prios_parent_id_fk'],
  ['qp_stats', '_parent_id', 'site_settings', 'id', 'qp_stats_parent_id_fk'],
  ['qp_dims', '_parent_id', 'site_settings', 'id', 'qp_dims_parent_id_fk'],
  ['qp_progs', '_parent_id', 'site_settings', 'id', 'qp_progs_parent_id_fk'],
  ['sv_boxes', '_parent_id', 'site_settings', 'id', 'sv_boxes_parent_id_fk'],
  ['fm_boxes', '_parent_id', 'site_settings', 'id', 'fm_boxes_parent_id_fk'],
  ['fb_boxes', '_parent_id', 'site_settings', 'id', 'fb_boxes_parent_id_fk'],
  ['ip_steps', '_parent_id', 'site_settings', 'id', 'ip_steps_parent_id_fk'],
  ['ip_hours', '_parent_id', 'site_settings', 'id', 'ip_hours_parent_id_fk'],
  ['ip_items', '_parent_id', 'site_settings', 'id', 'ip_items_parent_id_fk'],
  ['chk_pkgs', '_parent_id', 'site_settings', 'id', 'chk_pkgs_parent_id_fk'],
  ['hm_floors', '_parent_id', 'site_settings', 'id', 'hm_floors_parent_id_fk'],
  ['hm_facils', '_parent_id', 'site_settings', 'id', 'hm_facils_parent_id_fk'],
  ['site_assistant_topics', '_parent_id', 'site_settings', 'id', 'site_assistant_topics_parent_id_fk'],
  ['site_assistant_answers', '_parent_id', 'site_settings', 'id', 'site_assistant_answers_parent_id_fk'],
  ['_site_settings_v_version_header_contact_cards', '_parent_id', '_site_settings_v', 'id', '_site_settings_v_version_header_contact_cards_parent_id_fk'],
  ['_site_settings_v_version_header_social_links', '_parent_id', '_site_settings_v', 'id', '_site_settings_v_version_header_social_links_parent_id_fk'],
  ['_ef_steps_v', '_parent_id', '_ef_tabs_v', 'id', '_ef_steps_v_parent_id_fk'],
  ['_ef_tabs_v', '_parent_id', '_site_settings_v', 'id', '_ef_tabs_v_parent_id_fk'],
  ['_ef_checks_v', '_parent_id', '_site_settings_v', 'id', '_ef_checks_v_parent_id_fk'],
  ['_ef_prios_v', '_parent_id', '_site_settings_v', 'id', '_ef_prios_v_parent_id_fk'],
  ['_qp_stats_v', '_parent_id', '_site_settings_v', 'id', '_qp_stats_v_parent_id_fk'],
  ['_qp_dims_v', '_parent_id', '_site_settings_v', 'id', '_qp_dims_v_parent_id_fk'],
  ['_qp_progs_v', '_parent_id', '_site_settings_v', 'id', '_qp_progs_v_parent_id_fk'],
  ['_sv_boxes_v', '_parent_id', '_site_settings_v', 'id', '_sv_boxes_v_parent_id_fk'],
  ['_fm_boxes_v', '_parent_id', '_site_settings_v', 'id', '_fm_boxes_v_parent_id_fk'],
  ['_fb_boxes_v', '_parent_id', '_site_settings_v', 'id', '_fb_boxes_v_parent_id_fk'],
  ['_ip_steps_v', '_parent_id', '_site_settings_v', 'id', '_ip_steps_v_parent_id_fk'],
  ['_ip_hours_v', '_parent_id', '_site_settings_v', 'id', '_ip_hours_v_parent_id_fk'],
  ['_ip_items_v', '_parent_id', '_site_settings_v', 'id', '_ip_items_v_parent_id_fk'],
  ['_chk_pkgs_v', '_parent_id', '_site_settings_v', 'id', '_chk_pkgs_v_parent_id_fk'],
  ['_hm_floors_v', '_parent_id', '_site_settings_v', 'id', '_hm_floors_v_parent_id_fk'],
  ['_hm_facils_v', '_parent_id', '_site_settings_v', 'id', '_hm_facils_v_parent_id_fk'],
  ['_site_assistant_topics_v', '_parent_id', '_site_settings_v', 'id', '_site_assistant_topics_v_parent_id_fk'],
  ['_site_assistant_answers_v', '_parent_id', '_site_settings_v', 'id', '_site_assistant_answers_v_parent_id_fk'],
  ['navigation_items_children', '_parent_id', 'navigation_items', 'id', 'navigation_items_children_parent_id_fk'],
  ['navigation_items', '_parent_id', 'navigation', 'id', 'navigation_items_parent_id_fk'],
  ['navigation_rels', 'parent_id', 'navigation', 'id', 'navigation_rels_parent_fk'],
  ['_navigation_v_version_items_children', '_parent_id', '_navigation_v_version_items', 'id', '_navigation_v_version_items_children_parent_id_fk'],
  ['_navigation_v_version_items', '_parent_id', '_navigation_v', 'id', '_navigation_v_version_items_parent_id_fk'],
  ['_navigation_v_rels', 'parent_id', '_navigation_v', 'id', '_navigation_v_rels_parent_fk'],
  ['footer_columns_links', '_parent_id', 'footer_columns', 'id', 'footer_columns_links_parent_id_fk'],
  ['footer_columns', '_parent_id', 'footer', 'id', 'footer_columns_parent_id_fk'],
  ['_footer_v_version_columns_links', '_parent_id', '_footer_v_version_columns', 'id', '_footer_v_version_columns_links_parent_id_fk'],
  ['_footer_v_version_columns', '_parent_id', '_footer_v', 'id', '_footer_v_version_columns_parent_id_fk'],
  ['homepage_banners', '_parent_id', 'homepage', 'id', 'homepage_banners_parent_id_fk'],
  ['homepage_stats', '_parent_id', 'homepage', 'id', 'homepage_stats_parent_id_fk'],
  ['tech_items', '_parent_id', 'homepage_sections', 'id', 'tech_items_parent_id_fk'],
  ['expert_items', '_parent_id', 'homepage_sections', 'id', 'expert_items_parent_id_fk'],
  ['fn_sources', '_parent_id', 'homepage_sections', 'id', 'fn_sources_parent_id_fk'],
  ['content_values', '_parent_id', 'content_tabs', 'id', 'content_values_parent_id_fk'],
  ['news_manual', '_parent_id', 'content_tabs', 'id', 'news_manual_parent_id_fk'],
  ['content_tabs', '_parent_id', 'homepage_sections', 'id', 'content_tabs_parent_id_fk'],
  ['dept_values', '_parent_id', 'dept_tabs', 'id', 'dept_values_parent_id_fk'],
  ['dept_manual', '_parent_id', 'dept_tabs', 'id', 'dept_manual_parent_id_fk'],
  ['dept_tabs', '_parent_id', 'homepage_sections', 'id', 'dept_tabs_parent_id_fk'],
  ['schedule_manual', '_parent_id', 'homepage_sections_schedule_tab_order', 'id', 'schedule_manual_parent_id_fk'],
  ['homepage_sections_schedule_tab_order', '_parent_id', 'homepage_sections', 'id', 'homepage_sections_schedule_tab_order_parent_id_fk'],
  ['vaccine_manual', '_parent_id', 'homepage_vax_tabs', 'id', 'vaccine_manual_parent_id_fk'],
  ['homepage_vax_tabs', '_parent_id', 'homepage_sections', 'id', 'homepage_vax_tabs_parent_id_fk'],
  ['hp_svc_manual', '_parent_id', 'hp_svc_tabs', 'id', 'hp_svc_manual_parent_id_fk'],
  ['hp_svc_tabs', '_parent_id', 'homepage_sections', 'id', 'hp_svc_tabs_parent_id_fk'],
  ['hp_vax_manual', '_parent_id', 'hp_vax_tabs_cfg', 'id', 'hp_vax_manual_parent_id_fk'],
  ['hp_vax_tabs_cfg', '_parent_id', 'homepage_sections', 'id', 'hp_vax_tabs_cfg_parent_id_fk'],
  ['hp_custom_cards', '_parent_id', 'homepage_sections', 'id', 'hp_custom_cards_parent_id_fk'],
  ['hp_linked_items', '_parent_id', 'hp_linked_tabs', 'id', 'hp_linked_items_parent_id_fk'],
  ['hp_linked_tabs', '_parent_id', 'homepage_sections', 'id', 'hp_linked_tabs_parent_id_fk'],
  ['hp_partner_banners', '_parent_id', 'homepage_sections', 'id', 'hp_partner_banners_parent_id_fk'],
  ['homepage_sections', '_parent_id', 'homepage', 'id', 'homepage_sections_parent_id_fk'],
  ['_homepage_v_version_banners', '_parent_id', '_homepage_v', 'id', '_homepage_v_version_banners_parent_id_fk'],
  ['_homepage_v_version_stats', '_parent_id', '_homepage_v', 'id', '_homepage_v_version_stats_parent_id_fk'],
  ['_tech_items_v', '_parent_id', '_homepage_v_version_sections', 'id', '_tech_items_v_parent_id_fk'],
  ['_expert_items_v', '_parent_id', '_homepage_v_version_sections', 'id', '_expert_items_v_parent_id_fk'],
  ['_fn_sources_v', '_parent_id', '_homepage_v_version_sections', 'id', '_fn_sources_v_parent_id_fk'],
  ['_content_values_v', '_parent_id', '_content_tabs_v', 'id', '_content_values_v_parent_id_fk'],
  ['_news_manual_v', '_parent_id', '_content_tabs_v', 'id', '_news_manual_v_parent_id_fk'],
  ['_content_tabs_v', '_parent_id', '_homepage_v_version_sections', 'id', '_content_tabs_v_parent_id_fk'],
  ['_dept_values_v', '_parent_id', '_dept_tabs_v', 'id', '_dept_values_v_parent_id_fk'],
  ['_dept_manual_v', '_parent_id', '_dept_tabs_v', 'id', '_dept_manual_v_parent_id_fk'],
  ['_dept_tabs_v', '_parent_id', '_homepage_v_version_sections', 'id', '_dept_tabs_v_parent_id_fk'],
  ['_schedule_manual_v', '_parent_id', '_homepage_v_version_sections_schedule_tab_order', 'id', '_schedule_manual_v_parent_id_fk'],
  ['_homepage_v_version_sections_schedule_tab_order', '_parent_id', '_homepage_v_version_sections', 'id', '_homepage_v_version_sections_schedule_tab_order_parent_id_fk'],
  ['_vaccine_manual_v', '_parent_id', '_homepage_vax_tabs_v', 'id', '_vaccine_manual_v_parent_id_fk'],
  ['_homepage_vax_tabs_v', '_parent_id', '_homepage_v_version_sections', 'id', '_homepage_vax_tabs_v_parent_id_fk'],
  ['_hp_svc_manual_v', '_parent_id', '_hp_svc_tabs_v', 'id', '_hp_svc_manual_v_parent_id_fk'],
  ['_hp_svc_tabs_v', '_parent_id', '_homepage_v_version_sections', 'id', '_hp_svc_tabs_v_parent_id_fk'],
  ['_hp_vax_manual_v', '_parent_id', '_hp_vax_tabs_cfg_v', 'id', '_hp_vax_manual_v_parent_id_fk'],
  ['_hp_vax_tabs_cfg_v', '_parent_id', '_homepage_v_version_sections', 'id', '_hp_vax_tabs_cfg_v_parent_id_fk'],
  ['_hp_custom_cards_v', '_parent_id', '_homepage_v_version_sections', 'id', '_hp_custom_cards_v_parent_id_fk'],
  ['_hp_linked_items_v', '_parent_id', '_hp_linked_tabs_v', 'id', '_hp_linked_items_v_parent_id_fk'],
  ['_hp_linked_tabs_v', '_parent_id', '_homepage_v_version_sections', 'id', '_hp_linked_tabs_v_parent_id_fk'],
  ['_hp_partner_banners_v', '_parent_id', '_homepage_v_version_sections', 'id', '_hp_partner_banners_v_parent_id_fk'],
  ['_homepage_v_version_sections', '_parent_id', '_homepage_v', 'id', '_homepage_v_version_sections_parent_id_fk'],
  ['organization_chart_deputy_directors', '_parent_id', 'organization_chart', 'id', 'organization_chart_deputy_directors_parent_id_fk'],
  ['organization_chart_offices', '_parent_id', 'organization_chart', 'id', 'organization_chart_offices_parent_id_fk'],
  ['organization_chart_departments', '_parent_id', 'organization_chart', 'id', 'organization_chart_departments_parent_id_fk'],
  ['_organization_chart_v_version_deputy_directors', '_parent_id', '_organization_chart_v', 'id', '_organization_chart_v_version_deputy_directors_parent_id_fk'],
  ['_organization_chart_v_version_offices', '_parent_id', '_organization_chart_v', 'id', '_organization_chart_v_version_offices_parent_id_fk'],
  ['_organization_chart_v_version_departments', '_parent_id', '_organization_chart_v', 'id', '_organization_chart_v_version_departments_parent_id_fk'],
  ['hospital_history_quick_stats', '_parent_id', 'hospital_history', 'id', 'hospital_history_quick_stats_parent_id_fk'],
  ['hospital_history_milestones', '_parent_id', 'hospital_history', 'id', 'hospital_history_milestones_parent_id_fk'],
  ['history_core_values', '_parent_id', 'hospital_history', 'id', 'history_core_values_parent_id_fk'],
  ['hospital_history_journey_steps', '_parent_id', 'hospital_history', 'id', 'hospital_history_journey_steps_parent_id_fk'],
  ['hospital_history_achievements', '_parent_id', 'hospital_history', 'id', 'hospital_history_achievements_parent_id_fk'],
  ['hist_custom_blocks', '_parent_id', 'hospital_history', 'id', 'hist_custom_blocks_parent_id_fk'],
  ['_hospital_history_v_version_quick_stats', '_parent_id', '_hospital_history_v', 'id', '_hospital_history_v_version_quick_stats_parent_id_fk'],
  ['_hospital_history_v_version_milestones', '_parent_id', '_hospital_history_v', 'id', '_hospital_history_v_version_milestones_parent_id_fk'],
  ['_history_core_values_v', '_parent_id', '_hospital_history_v', 'id', '_history_core_values_v_parent_id_fk'],
  ['_hospital_history_v_version_journey_steps', '_parent_id', '_hospital_history_v', 'id', '_hospital_history_v_version_journey_steps_parent_id_fk'],
  ['_hospital_history_v_version_achievements', '_parent_id', '_hospital_history_v', 'id', '_hospital_history_v_version_achievements_parent_id_fk'],
  ['_hist_custom_blocks_v', '_parent_id', '_hospital_history_v', 'id', '_hist_custom_blocks_v_parent_id_fk'],
  ['about_page_stats', '_parent_id', 'about_page', 'id', 'about_page_stats_parent_id_fk'],
  ['about_page_core_principles_items', '_parent_id', 'about_page', 'id', 'about_page_core_principles_items_parent_id_fk'],
  ['about_page_facilities_items', '_parent_id', 'about_page', 'id', 'about_page_facilities_items_parent_id_fk'],
  ['ab_custom_blocks', '_parent_id', 'about_page', 'id', 'ab_custom_blocks_parent_id_fk'],
  ['about_page_related_links_links', '_parent_id', 'about_page', 'id', 'about_page_related_links_links_parent_id_fk'],
  ['_about_page_v_version_stats', '_parent_id', '_about_page_v', 'id', '_about_page_v_version_stats_parent_id_fk'],
  ['_about_page_v_version_core_principles_items', '_parent_id', '_about_page_v', 'id', '_about_page_v_version_core_principles_items_parent_id_fk'],
  ['_about_page_v_version_facilities_items', '_parent_id', '_about_page_v', 'id', '_about_page_v_version_facilities_items_parent_id_fk'],
  ['_ab_custom_blocks_v', '_parent_id', '_about_page_v', 'id', '_ab_custom_blocks_v_parent_id_fk'],
  ['_about_page_v_version_related_links_links', '_parent_id', '_about_page_v', 'id', '_about_page_v_version_related_links_links_parent_id_fk'],
  ['wh_milestones', '_parent_id', 'working_hours_settings', 'id', 'wh_milestones_parent_id_fk'],
  ['wh_dept_rows', '_parent_id', 'wh_depts', 'id', 'wh_dept_rows_parent_id_fk'],
  ['wh_depts', '_parent_id', 'working_hours_settings', 'id', 'wh_depts_parent_id_fk'],
  ['wh_sched_links', '_parent_id', 'working_hours_settings', 'id', 'wh_sched_links_parent_id_fk'],
  ['wh_notes', '_parent_id', 'working_hours_settings', 'id', 'wh_notes_parent_id_fk'],
  ['pps_sub_tabs', '_parent_id', 'patient_portal_settings', 'id', 'pps_sub_tabs_parent_id_fk'],
  ['pps_commits', '_parent_id', 'patient_portal_settings', 'id', 'pps_commits_parent_id_fk'],
  ['pps_svc_items', '_parent_id', 'pps_svc_groups', 'id', 'pps_svc_items_parent_id_fk'],
  ['pps_svc_groups', '_parent_id', 'patient_portal_settings', 'id', 'pps_svc_groups_parent_id_fk'],
  ['pps_custom_blocks', '_parent_id', 'patient_portal_settings', 'id', 'pps_custom_blocks_parent_id_fk'],
  ['examination_flow_settings_flow_tabs_steps', '_parent_id', 'examination_flow_settings_flow_tabs', 'id', 'examination_flow_settings_flow_tabs_steps_parent_id_fk'],
  ['examination_flow_settings_flow_tabs', '_parent_id', 'examination_flow_settings', 'id', 'examination_flow_settings_flow_tabs_parent_id_fk'],
  ['examination_flow_settings_checklists', '_parent_id', 'examination_flow_settings', 'id', 'examination_flow_settings_checklists_parent_id_fk'],
  ['examination_flow_settings_priorities', '_parent_id', 'examination_flow_settings', 'id', 'examination_flow_settings_priorities_parent_id_fk'],
  ['efs_custom_blocks', '_parent_id', 'examination_flow_settings', 'id', 'efs_custom_blocks_parent_id_fk'],
  ['inpatient_guide_settings_admission_steps', '_parent_id', 'inpatient_guide_settings', 'id', 'inpatient_guide_settings_admission_steps_parent_id_fk'],
  ['inpatient_guide_settings_visiting_hours', '_parent_id', 'inpatient_guide_settings', 'id', 'inpatient_guide_settings_visiting_hours_parent_id_fk'],
  ['inpatient_guide_settings_belongings_checklist', '_parent_id', 'inpatient_guide_settings', 'id', 'inpatient_guide_settings_belongings_checklist_parent_id_fk'],
  ['igs_custom_blocks', '_parent_id', 'inpatient_guide_settings', 'id', 'igs_custom_blocks_parent_id_fk'],
  ['checkup_packages_settings_packages', '_parent_id', 'checkup_packages_settings', 'id', 'checkup_packages_settings_packages_parent_id_fk'],
  ['cps_custom_blocks', '_parent_id', 'checkup_packages_settings', 'id', 'cps_custom_blocks_parent_id_fk'],
  ['hospital_map_settings_floors', '_parent_id', 'hospital_map_settings', 'id', 'hospital_map_settings_floors_parent_id_fk'],
  ['hospital_map_settings_facilities', '_parent_id', 'hospital_map_settings', 'id', 'hospital_map_settings_facilities_parent_id_fk'],
  ['hms_custom_blocks', '_parent_id', 'hospital_map_settings', 'id', 'hms_custom_blocks_parent_id_fk'],
  ['hospital_quality_settings_stat_cards', '_parent_id', 'hospital_quality_settings', 'id', 'hospital_quality_settings_stat_cards_parent_id_fk'],
  ['hospital_quality_settings_dimensions', '_parent_id', 'hospital_quality_settings', 'id', 'hospital_quality_settings_dimensions_parent_id_fk'],
  ['hospital_quality_settings_programs', '_parent_id', 'hospital_quality_settings', 'id', 'hospital_quality_settings_programs_parent_id_fk'],
  ['hqs_custom_blocks', '_parent_id', 'hospital_quality_settings', 'id', 'hqs_custom_blocks_parent_id_fk'],
  ['survey_page_settings_info_boxes', '_parent_id', 'survey_page_settings', 'id', 'survey_page_settings_info_boxes_parent_id_fk'],
  ['forms_page_settings_info_boxes', '_parent_id', 'forms_page_settings', 'id', 'forms_page_settings_info_boxes_parent_id_fk'],
  ['feedback_page_settings_info_boxes', '_parent_id', 'feedback_page_settings', 'id', 'feedback_page_settings_info_boxes_parent_id_fk'],
  ['default_media_settings_custom_defaults', '_parent_id', 'default_media_settings', 'id', 'default_media_settings_custom_defaults_parent_id_fk'],
  ['seo_settings_robots_disallow', '_parent_id', 'seo_settings', 'id', 'seo_settings_robots_disallow_parent_id_fk'],
  ['_seo_settings_v_version_robots_disallow', '_parent_id', '_seo_settings_v', 'id', '_seo_settings_v_version_robots_disallow_parent_id_fk'],
  ['cb_quick_topics', '_parent_id', 'chatbot_settings', 'id', 'cb_quick_topics_parent_id_fk'],
  ['sch_notes', '_parent_id', 'schedule_settings', 'id', 'sch_notes_parent_id_fk'],
  ['appointment_settings_time_slots', '_parent_id', 'appointment_settings', 'id', 'appointment_settings_time_slots_parent_id_fk'],
  ['appointment_settings_custom_specialties', '_parent_id', 'appointment_settings', 'id', 'appointment_settings_custom_specialties_parent_id_fk'],
  ['appointment_settings_custom_fields', '_parent_id', 'appointment_settings', 'id', 'appointment_settings_custom_fields_parent_id_fk'],
  ['appointment_settings_rels', 'parent_id', 'appointment_settings', 'id', 'appointment_settings_rels_parent_fk'],
  ['quick_links_settings_items', '_parent_id', 'quick_links_settings', 'id', 'quick_links_settings_items_parent_id_fk'],
  ['_quick_links_settings_v_version_items', '_parent_id', '_quick_links_settings_v', 'id', '_quick_links_settings_v_version_items_parent_id_fk'],
  ['ads_share_btns', '_parent_id', 'article_detail_settings', 'id', 'ads_share_btns_parent_id_fk'],
  ['vcs_custom_blocks', '_parent_id', 'vaccination_settings', 'id', 'vcs_custom_blocks_parent_id_fk'],
]

export async function up({ client }) {
  // 1. Dọn dữ liệu mồ côi và khôi phục ON DELETE CASCADE cho toàn bộ bảng con / bảng lồng nhau
  for (const [childTable, childCol, parentTable, parentCol, fkName] of PARENT_CASCADE_FKS) {
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${childTable}')
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${parentTable}') THEN
          DELETE FROM public."${childTable}" c
          WHERE c."${childCol}" IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM public."${parentTable}" p WHERE p."${parentCol}" = c."${childCol}"
            );

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = '${fkName}'
              AND connamespace = 'public'::regnamespace
              AND confdeltype = 'c'
          ) THEN
            ALTER TABLE public."${childTable}" DROP CONSTRAINT IF EXISTS "${fkName}";
            ALTER TABLE public."${childTable}"
              ADD CONSTRAINT "${fkName}"
              FOREIGN KEY ("${childCol}")
              REFERENCES public."${parentTable}"("${parentCol}")
              ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `)
  }

  // 2. Đồng bộ lại toàn bộ SERIAL / sequence trên public schema để không bao giờ bị trùng ID
  const seqRes = await client.query(`
    SELECT
      t.table_name,
      c.column_name,
      pg_get_serial_sequence(format('public.%I', t.table_name), c.column_name) AS seq_name
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_default LIKE 'nextval%'
    ORDER BY t.table_name;
  `)

  for (const row of seqRes.rows) {
    if (!row.seq_name) continue
    await client.query(`
      SELECT setval(
        $1,
        GREATEST(COALESCE((SELECT MAX("${row.column_name}") FROM public."${row.table_name}"), 0), 1),
        (SELECT COUNT(*) > 0 FROM public."${row.table_name}")
      );
    `, [row.seq_name])
  }
}

export async function verify({ client }) {
  const fkCheck = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'f'
      AND confdeltype = 'c'
      AND conname IN (
        'navigation_items_parent_id_fk',
        'navigation_items_children_parent_id_fk',
        '_navigation_v_version_items_parent_id_fk',
        '_navigation_v_version_items_children_parent_id_fk'
      );
  `)
  if (fkCheck.rowCount < 4) {
    throw new Error('Các khóa ngoại ON DELETE CASCADE của bảng navigation / navigation_items_children chưa được tạo đầy đủ.')
  }
}
