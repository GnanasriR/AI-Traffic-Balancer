"""
Pygame Graphical Interface for SignalSync AI Traffic Simulator.
Renders smooth 60 FPS 2D canvas, animated vehicles, 4-stage signals, and interactive control HUD.
"""

import pygame
import math
import sys
from traffic_simulator.config import (
    WINDOW_WIDTH, WINDOW_HEIGHT, SIM_CANVAS_SIZE, HUD_WIDTH, FPS,
    CENTER_X, CENTER_Y, ROAD_WIDTH, LANE_WIDTH,
    STOP_NORTH, STOP_SOUTH, STOP_EAST, STOP_WEST,
    COLOR_ASPHALT, COLOR_GRASS, COLOR_CURB, COLOR_LANE_LINE, COLOR_STOP_LINE, COLOR_ZEBRA,
    COLOR_RED_SIGNAL, COLOR_YELLOW_SIGNAL, COLOR_GREEN_SIGNAL, COLOR_OFF_SIGNAL,
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_TEXT_WHITE, COLOR_TEXT_MUTED, COLOR_ACCENT_BLUE, COLOR_ACCENT_ORANGE,
    COLOR_PEDESTRIAN, COLOR_WALK_SIGNAL, COLOR_DONT_WALK_SIGNAL,
    ARM_ORDER
)

class SimulationGUI:
    def __init__(self, intersection, signal_controller, metrics_tracker, srv_module=None):
        pygame.init()
        pygame.display.set_caption("SignalSync — AI Urban Traffic Simulator")
        
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        self.clock = pygame.time.Clock()

        self.intersection = intersection
        self.signal_controller = signal_controller
        self.metrics_tracker = metrics_tracker
        self.srv_module = srv_module

        self.font_large = pygame.font.SysFont("Segoe UI, Arial", 22, bold=True)
        self.font_medium = pygame.font.SysFont("Segoe UI, Arial", 16, bold=True)
        self.font_small = pygame.font.SysFont("Segoe UI, Arial", 13)
        self.font_digits = pygame.font.SysFont("Consolas, Courier", 15, bold=True)

        self.is_paused = False if not srv_module else (not srv_module.is_running)
        self.flash_timer = 0.0

        # UI Interactive Buttons (bounding rectangles)
        self.btn_pause = pygame.Rect(820, 680, 120, 36)
        self.btn_mode = pygame.Rect(950, 680, 130, 36)
        self.btn_ambulance = pygame.Rect(820, 725, 260, 36)
        self.btn_report = pygame.Rect(820, 635, 260, 36)

        self.notification_text = "System Ready. Operating on Adaptive AI Mode."
        self.notification_timer = 3.0

    def run_frame(self, dt=1.0/60.0):
        """Processes events, updates physics (if unpaused), and renders GUI frame."""
        self._handle_events()

        if self.srv_module is not None:
            self.is_paused = not self.srv_module.is_running

        if not self.is_paused:
            self.intersection.update(self.signal_controller, dt)
            self.signal_controller.update(self.intersection, dt)
            self.metrics_tracker.update(self.intersection, self.signal_controller, dt)
            self.flash_timer += dt

        if self.notification_timer > 0:
            self.notification_timer -= dt

        # Render Scene
        self.screen.fill(COLOR_BG_DARK)
        self._draw_road_canvas()
        self._draw_vehicles()
        self._draw_pedestrians()
        self._draw_traffic_signals()
        self._draw_hud_sidebar()

        pygame.display.flip()
        self.clock.tick(FPS)

    def _handle_events(self):
        """Handles mouse clicks and keyboard user input."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    self.is_paused = not self.is_paused
                    if self.srv_module is not None:
                        self.srv_module.is_running = not self.is_paused
                elif event.key == pygame.K_m:
                    new_mode = self.signal_controller.toggle_mode()
                    self._show_notify(f"Switched Control Mode to: {new_mode}")
                elif event.key == pygame.K_a:
                    spawned_arm = self.intersection.spawn_emergency_vehicle(None)
                    if spawned_arm:
                        self.signal_controller.trigger_emergency(spawned_arm)
                        self._show_notify(f"EMERGENCY AMBULANCE DISPATCHED ON {spawned_arm} ARM!")

            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    pos = event.pos
                    if self.btn_pause.collidepoint(pos):
                        self.is_paused = not self.is_paused
                        if self.srv_module is not None:
                            self.srv_module.is_running = not self.is_paused
                    elif self.btn_mode.collidepoint(pos):
                        new_mode = self.signal_controller.toggle_mode()
                        self._show_notify(f"Switched Control Mode to: {new_mode}")
                    elif self.btn_ambulance.collidepoint(pos):
                        spawned_arm = self.intersection.spawn_emergency_vehicle(None)
                        if spawned_arm:
                            self.signal_controller.trigger_emergency(spawned_arm)
                            self._show_notify(f"EMERGENCY AMBULANCE DISPATCHED ON {spawned_arm} ARM!")
                    elif self.btn_report.collidepoint(pos):
                        path = self.metrics_tracker.generate_summary_plot()
                        if path:
                            self._show_notify(f"Report saved: {path}")

    def _show_notify(self, msg):
        self.notification_text = msg
        self.notification_timer = 4.0

    def _draw_road_canvas(self):
        """Renders grass, asphalt roads, lane markings, zebra crossings, and stop lines."""
        # 1. Grass Background (Left 800x800 area)
        canvas_rect = pygame.Rect(0, 0, SIM_CANVAS_SIZE, SIM_CANVAS_SIZE)
        pygame.draw.rect(self.screen, COLOR_GRASS, canvas_rect)

        hw = ROAD_WIDTH // 2  # 90px

        # 2. Asphalt Cross Roads
        # Vertical Road (North-South)
        pygame.draw.rect(self.screen, COLOR_ASPHALT, (CENTER_X - hw, 0, ROAD_WIDTH, SIM_CANVAS_SIZE))
        # Horizontal Road (East-West)
        pygame.draw.rect(self.screen, COLOR_ASPHALT, (0, CENTER_Y - hw, SIM_CANVAS_SIZE, ROAD_WIDTH))

        # 3. Curbs (White borders around corners)
        pygame.draw.rect(self.screen, COLOR_CURB, (0, CENTER_Y - hw - 3, CENTER_X - hw, 4))
        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X + hw, CENTER_Y - hw - 3, CENTER_X - hw, 4))
        pygame.draw.rect(self.screen, COLOR_CURB, (0, CENTER_Y + hw, CENTER_X - hw, 4))
        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X + hw, CENTER_Y + hw, CENTER_X - hw, 4))

        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X - hw - 3, 0, 4, CENTER_Y - hw))
        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X + hw, 0, 4, CENTER_Y - hw))
        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X - hw - 3, CENTER_Y + hw, 4, CENTER_Y - hw))
        pygame.draw.rect(self.screen, COLOR_CURB, (CENTER_X + hw, CENTER_Y + hw, 4, CENTER_Y - hw))

        # 4. Yellow Center Divider Lines
        pygame.draw.line(self.screen, COLOR_LANE_LINE, (CENTER_X, 0), (CENTER_X, CENTER_Y - hw), 3)
        pygame.draw.line(self.screen, COLOR_LANE_LINE, (CENTER_X, CENTER_Y + hw), (CENTER_X, SIM_CANVAS_SIZE), 3)
        pygame.draw.line(self.screen, COLOR_LANE_LINE, (0, CENTER_Y), (CENTER_X - hw, CENTER_Y), 3)
        pygame.draw.line(self.screen, COLOR_LANE_LINE, (CENTER_X + hw, CENTER_Y), (SIM_CANVAS_SIZE, CENTER_Y), 3)

        # 5. White Stop Lines
        pygame.draw.line(self.screen, COLOR_STOP_LINE, (CENTER_X, STOP_NORTH), (CENTER_X - hw, STOP_NORTH), 5)
        pygame.draw.line(self.screen, COLOR_STOP_LINE, (CENTER_X, STOP_SOUTH), (CENTER_X + hw, STOP_SOUTH), 5)
        pygame.draw.line(self.screen, COLOR_STOP_LINE, (STOP_EAST, CENTER_Y), (STOP_EAST, CENTER_Y - hw), 5)
        pygame.draw.line(self.screen, COLOR_STOP_LINE, (STOP_WEST, CENTER_Y), (STOP_WEST, CENTER_Y + hw), 5)

        # 6. Zebra Crossings (Pedestrian Stripes)
        for i in range(CENTER_X - hw + 6, CENTER_X + hw - 6, 16):
            # North & South Zebra
            pygame.draw.rect(self.screen, COLOR_ZEBRA, (i, STOP_NORTH - 25, 10, 20))
            pygame.draw.rect(self.screen, COLOR_ZEBRA, (i, STOP_SOUTH + 5, 10, 20))
            # East & West Zebra
            pygame.draw.rect(self.screen, COLOR_ZEBRA, (STOP_WEST - 25, i, 20, 10))
            pygame.draw.rect(self.screen, COLOR_ZEBRA, (STOP_EAST + 5, i, 20, 10))

    def _draw_vehicles(self):
        """Renders active vehicles with orientation rotation, brake lights, and ambulance flashes."""
        for arm in ARM_ORDER:
            for v in self.intersection.vehicles[arm]:
                # Vehicle Surface
                v_surf = pygame.Surface((v.length, v.width), pygame.SRCALPHA)
                
                # Main Body
                body_color = v.color
                pygame.draw.rect(v_surf, body_color, (0, 0, v.length, v.width), border_radius=4)
                pygame.draw.rect(v_surf, (20, 25, 30), (2, 2, v.length - 4, v.width - 4), 1, border_radius=3)

                # Windshield / Windows
                pygame.draw.rect(v_surf, (180, 210, 230), (v.length * 0.55, 3, v.length * 0.25, v.width - 6), border_radius=2)

                # Red Brake Lights if stopped/slowing
                if v.speed < 0.5:
                    pygame.draw.circle(v_surf, (255, 0, 0), (3, 4), 3)
                    pygame.draw.circle(v_surf, (255, 0, 0), (3, v.width - 4), 3)

                # Emergency Flashing Light on Ambulance
                if v.is_emergency:
                    flash_color = (255, 0, 0) if (int(self.flash_timer * 10) % 2 == 0) else (0, 100, 255)
                    pygame.draw.circle(v_surf, flash_color, (int(v.length * 0.5), int(v.width * 0.5)), 5)

                # Rotate sprite surface to match vehicle orientation
                # Note: Pygame rotates counter-clockwise around center
                rotated_surf = pygame.transform.rotate(v_surf, -v.angle)
                new_rect = rotated_surf.get_rect(center=(int(v.x), int(v.y)))
                
                self.screen.blit(rotated_surf, new_rect.topleft)

    def _draw_pedestrians(self):
        """Renders pedestrians crossing during the scramble WALK phase as small
        walking figures on their crosswalk, plus a WALK/DONT_WALK badge."""
        crosswalk_state = self.signal_controller.get_crosswalk_state()

        for arm in ARM_ORDER:
            for p in self.intersection.pedestrians[arm]:
                bob = 2 if int(self.flash_timer * 8) % 2 == 0 else -2
                pygame.draw.circle(self.screen, COLOR_PEDESTRIAN, (int(p.x), int(p.y) + bob), 4)
                pygame.draw.circle(self.screen, (40, 40, 40), (int(p.x), int(p.y) + bob), 4, 1)

        if crosswalk_state != "DONT_WALK":
            badge_color = COLOR_WALK_SIGNAL if crosswalk_state == "WALK" else COLOR_ACCENT_ORANGE
            label = "WALK" if crosswalk_state == "WALK" else "CLEAR"
            badge = self.font_medium.render(f"PED: {label}", True, badge_color)
            self.screen.blit(badge, (CENTER_X - 30, CENTER_Y - 10))

    def _draw_traffic_signals(self):
        """Renders 3-aspect signal heads at all 4 stop lines with active phase glow."""
        signal_positions = {
            "NORTH": (CENTER_X - ROAD_WIDTH // 2 - 25, STOP_NORTH - 50),
            "SOUTH": (CENTER_X + ROAD_WIDTH // 2 + 10, STOP_SOUTH + 10),
            "EAST":  (STOP_EAST + 10, CENTER_Y - ROAD_WIDTH // 2 - 35),
            "WEST":  (STOP_WEST - 45, CENTER_Y + ROAD_WIDTH // 2 + 10)
        }

        for arm in ARM_ORDER:
            pos_x, pos_y = signal_positions[arm]
            color_state = self.signal_controller.get_arm_signal_color(arm)

            # Signal Head Box (Dark grey border box)
            pygame.draw.rect(self.screen, (20, 20, 20), (pos_x, pos_y, 35, 75), border_radius=6)
            pygame.draw.rect(self.screen, (100, 100, 100), (pos_x, pos_y, 35, 75), 2, border_radius=6)

            # 3 Lights (Red, Yellow, Green)
            r_col = COLOR_RED_SIGNAL if color_state == "RED" else COLOR_OFF_SIGNAL
            y_col = COLOR_YELLOW_SIGNAL if color_state == "YELLOW" else COLOR_OFF_SIGNAL
            g_col = COLOR_GREEN_SIGNAL if color_state == "GREEN" else COLOR_OFF_SIGNAL

            pygame.draw.circle(self.screen, r_col, (pos_x + 17, pos_y + 15), 9)
            pygame.draw.circle(self.screen, y_col, (pos_x + 17, pos_y + 37), 9)
            pygame.draw.circle(self.screen, g_col, (pos_x + 17, pos_y + 59), 9)

            # Timer badge for active signal arm
            if color_state in ("GREEN", "YELLOW"):
                rem_sec = int(self.signal_controller.get_remaining_time())
                badge_surf = self.font_digits.render(f"{rem_sec}s", True, COLOR_TEXT_WHITE)
                badge_rect = badge_surf.get_rect(center=(pos_x + 17, pos_y - 12))
                
                pygame.draw.rect(self.screen, (0, 0, 0), badge_rect.inflate(8, 4), border_radius=3)
                self.screen.blit(badge_surf, badge_rect)

    def _draw_hud_sidebar(self):
        """Renders right sidebar dashboard containing system telemetry and control buttons."""
        sidebar_x = SIM_CANVAS_SIZE
        sidebar_rect = pygame.Rect(sidebar_x, 0, HUD_WIDTH, WINDOW_HEIGHT)
        pygame.draw.rect(self.screen, COLOR_CARD_BG, sidebar_rect)
        pygame.draw.line(self.screen, (50, 60, 80), (sidebar_x, 0), (sidebar_x, WINDOW_HEIGHT), 2)

        # Header Title
        title = self.font_large.render("SignalSync AI", True, COLOR_ACCENT_BLUE)
        subtitle = self.font_small.render("Urban Traffic Simulator v2.0", True, COLOR_TEXT_MUTED)
        self.screen.blit(title, (sidebar_x + 20, 20))
        self.screen.blit(subtitle, (sidebar_x + 20, 48))

        y = 85
        # 1. Controller Mode Card
        pygame.draw.rect(self.screen, COLOR_BG_DARK, (sidebar_x + 15, y, 270, 75), border_radius=8)
        mode_lbl = self.font_small.render("ACTIVE CONTROL MODE", True, COLOR_TEXT_MUTED)
        mode_val = self.font_medium.render(self.signal_controller.mode, True, 
                                           COLOR_GREEN_SIGNAL if self.signal_controller.mode == "ADAPTIVE_AI" else COLOR_ACCENT_ORANGE)
        self.screen.blit(mode_lbl, (sidebar_x + 25, y + 10))
        self.screen.blit(mode_val, (sidebar_x + 25, y + 32))

        active_arm = self.signal_controller.get_active_arm() or "PED SCRAMBLE"
        phase_st = self.signal_controller.phase_state
        stage_txt = self.font_small.render(f"Active Stage: {active_arm} ({phase_st})", True, COLOR_TEXT_WHITE)
        self.screen.blit(stage_txt, (sidebar_x + 25, y + 52))

        y += 90
        # 2. Queue Telemetry Card
        pygame.draw.rect(self.screen, COLOR_BG_DARK, (sidebar_x + 15, y, 270, 150), border_radius=8)
        q_header = self.font_medium.render("Approach Queue Telemetry", True, COLOR_TEXT_WHITE)
        self.screen.blit(q_header, (sidebar_x + 25, y + 12))

        q_south = self.intersection.get_arm_queue("SOUTH")
        q_north = self.intersection.get_arm_queue("NORTH")
        q_east  = self.intersection.get_arm_queue("EAST")
        q_west  = self.intersection.get_arm_queue("WEST")

        self.screen.blit(self.font_small.render(f"South Arm Queue:  {q_south} veh", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 42))
        self.screen.blit(self.font_small.render(f"North Arm Queue:  {q_north} veh", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 66))
        self.screen.blit(self.font_small.render(f"East Arm Queue:   {q_east} veh", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 90))
        self.screen.blit(self.font_small.render(f"West Arm Queue:   {q_west} veh", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 114))

        y += 165
        # 3. Operations KPIs Card
        pygame.draw.rect(self.screen, COLOR_BG_DARK, (sidebar_x + 15, y, 270, 130), border_radius=8)
        kpi_header = self.font_medium.render("System Performance KPIs", True, COLOR_TEXT_WHITE)
        self.screen.blit(kpi_header, (sidebar_x + 25, y + 12))

        completed_count = len(self.intersection.completed_vehicles)
        avg_wait = (sum(v['wait_time'] for v in self.intersection.completed_vehicles) / completed_count) if completed_count else 0.0
        fps_val = int(self.clock.get_fps())

        self.screen.blit(self.font_small.render(f"Total Served:   {completed_count} vehicles", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 42))
        self.screen.blit(self.font_small.render(f"Avg Wait Time:  {avg_wait:.1f} sec", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 66))
        self.screen.blit(self.font_small.render(f"Simulation FPS: {fps_val} FPS", True, COLOR_TEXT_WHITE), (sidebar_x + 25, y + 90))

        # Notification Toast Message
        if self.notification_timer > 0:
            toast_rect = pygame.Rect(sidebar_x + 15, 570, 270, 50)
            pygame.draw.rect(self.screen, (40, 60, 90), toast_rect, border_radius=6)
            pygame.draw.rect(self.screen, COLOR_ACCENT_BLUE, toast_rect, 1, border_radius=6)
            
            lines = self.notification_text.split('\n')
            for i, line in enumerate(lines[:2]):
                t_surf = self.font_small.render(line, True, COLOR_TEXT_WHITE)
                self.screen.blit(t_surf, (sidebar_x + 25, 576 + i * 20))

        # 4. Interactive UI Control Buttons
        # Save Report Button
        pygame.draw.rect(self.screen, (52, 73, 94), self.btn_report, border_radius=6)
        rep_txt = self.font_small.render("Generate Analytics Chart", True, COLOR_TEXT_WHITE)
        self.screen.blit(rep_txt, rep_txt.get_rect(center=self.btn_report.center))

        # Pause / Play Button
        pause_bg = COLOR_ACCENT_ORANGE if self.is_paused else (46, 204, 113)
        pygame.draw.rect(self.screen, pause_bg, self.btn_pause, border_radius=6)
        p_txt = self.font_small.render("Resume" if self.is_paused else "Pause", True, COLOR_TEXT_WHITE)
        self.screen.blit(p_txt, p_txt.get_rect(center=self.btn_pause.center))

        # Switch Mode Button
        pygame.draw.rect(self.screen, COLOR_ACCENT_BLUE, self.btn_mode, border_radius=6)
        m_txt = self.font_small.render("Switch AI Mode", True, COLOR_TEXT_WHITE)
        self.screen.blit(m_txt, m_txt.get_rect(center=self.btn_mode.center))

        # Dispatch Ambulance Emergency Button
        pygame.draw.rect(self.screen, (231, 76, 60), self.btn_ambulance, border_radius=6)
        amb_txt = self.font_small.render("Dispatch Ambulance", True, COLOR_TEXT_WHITE)
        self.screen.blit(amb_txt, amb_txt.get_rect(center=self.btn_ambulance.center))
